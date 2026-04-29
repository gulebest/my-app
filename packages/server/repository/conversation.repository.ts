export type ChatMessage = {
   role: 'system' | 'user' | 'assistant';
   content: string;
};

export type ConversationSummary = {
   conversationId: string;
   title: string;
   lastMessage: string;
   createdAt: string | null;
   updatedAt: string | null;
};

import { FieldValue } from 'firebase-admin/firestore';
import {
   firebaseAdminDb,
   isFirebaseAdminCredentialConfigured,
} from '../lib/firebase-admin';

const MAX_CONTEXT_MESSAGES = 40;

function isPersistentUser(uid: string) {
   return uid !== 'anonymous';
}

function localConversationKey(uid: string, conversationId: string) {
   return `${uid}:${conversationId}`;
}

function conversationRef(uid: string, conversationId: string) {
   return firebaseAdminDb.doc(`users/${uid}/conversations/${conversationId}`);
}

function messagesCollection(uid: string, conversationId: string) {
   return firebaseAdminDb.collection(
      `users/${uid}/conversations/${conversationId}/messages`
   );
}

function toIsoTimestamp(value: unknown): string | null {
   if (!value) {
      return null;
   }
   if (value instanceof Date) {
      return value.toISOString();
   }
   if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof value.toDate === 'function'
   ) {
      const asDate = value.toDate();
      return asDate instanceof Date ? asDate.toISOString() : null;
   }
   return null;
}

class ConversationRepository {
   private transientConversations = new Map<string, ChatMessage[]>();
   private hasLoggedFirestoreFallback = false;

   private logFirestoreFallback(error?: unknown) {
      if (this.hasLoggedFirestoreFallback) {
         return;
      }
      this.hasLoggedFirestoreFallback = true;
      console.warn(
         'Falling back to in-memory conversation storage because Firestore Admin is unavailable.',
         error
      );
   }

   private getTransientConversation(uid: string, conversationId: string) {
      return (
         this.transientConversations.get(
            localConversationKey(uid, conversationId)
         ) ?? []
      );
   }

   private listTransientConversationSummaries(
      uid: string
   ): ConversationSummary[] {
      const prefix = `${uid}:`;
      const summaries: ConversationSummary[] = [];

      for (const [key, messages] of this.transientConversations.entries()) {
         if (!key.startsWith(prefix)) {
            continue;
         }

         const conversationId = key.slice(prefix.length);
         const firstUserMessage = messages.find((item) => item.role === 'user');
         const lastAssistantMessage = [...messages]
            .reverse()
            .find((item) => item.role === 'assistant');
         summaries.push({
            conversationId,
            title: (firstUserMessage?.content || 'New conversation').slice(
               0,
               80
            ),
            lastMessage: (lastAssistantMessage?.content || '').slice(0, 180),
            createdAt: null,
            updatedAt: null,
         });
      }

      return summaries;
   }

   async getConversation(
      uid: string,
      conversationId: string
   ): Promise<ChatMessage[]> {
      if (!isPersistentUser(uid) || !isFirebaseAdminCredentialConfigured()) {
         return this.getTransientConversation(uid, conversationId);
      }

      try {
         const snapshot = await messagesCollection(uid, conversationId)
            .orderBy('createdAt', 'desc')
            .limit(MAX_CONTEXT_MESSAGES)
            .get();

         return snapshot.docs
            .slice()
            .reverse()
            .map((doc) => doc.data())
            .filter(
               (item) =>
                  item.role === 'system' ||
                  item.role === 'user' ||
                  item.role === 'assistant'
            )
            .map((item) => ({
               role: item.role as ChatMessage['role'],
               content: String(item.content || ''),
            }))
            .filter((item) => item.content.trim().length > 0);
      } catch (error) {
         this.logFirestoreFallback(error);
         return this.getTransientConversation(uid, conversationId);
      }
   }

   async appendTurn(
      uid: string,
      conversationId: string,
      userPrompt: string,
      assistantReply: string
   ): Promise<void> {
      if (!isPersistentUser(uid) || !isFirebaseAdminCredentialConfigured()) {
         const key = localConversationKey(uid, conversationId);
         const previous = this.transientConversations.get(key) ?? [];
         previous.push({ role: 'user', content: userPrompt });
         previous.push({ role: 'assistant', content: assistantReply });
         this.transientConversations.set(key, previous);
         return;
      }

      const convoRef = conversationRef(uid, conversationId);
      const messagesRef = messagesCollection(uid, conversationId);
      const userMessageRef = messagesRef.doc();
      const assistantMessageRef = messagesRef.doc();

      try {
         await firebaseAdminDb.runTransaction(async (tx) => {
            const existingConversation = await tx.get(convoRef);
            const currentTitle = String(
               existingConversation.data()?.title || ''
            ).trim();

            const metadata = {
               title: currentTitle || userPrompt.slice(0, 80),
               lastMessage: assistantReply.slice(0, 180),
               updatedAt: FieldValue.serverTimestamp(),
            };

            if (existingConversation.exists) {
               tx.set(convoRef, metadata, { merge: true });
            } else {
               tx.set(convoRef, {
                  ...metadata,
                  createdAt: FieldValue.serverTimestamp(),
               });
            }

            tx.set(userMessageRef, {
               role: 'user',
               content: userPrompt,
               createdAt: FieldValue.serverTimestamp(),
            });

            tx.set(assistantMessageRef, {
               role: 'assistant',
               content: assistantReply,
               createdAt: FieldValue.serverTimestamp(),
            });
         });
      } catch (error) {
         this.logFirestoreFallback(error);
         const key = localConversationKey(uid, conversationId);
         const previous = this.transientConversations.get(key) ?? [];
         previous.push({ role: 'user', content: userPrompt });
         previous.push({ role: 'assistant', content: assistantReply });
         this.transientConversations.set(key, previous);
      }
   }

   async listConversations(
      uid: string,
      maxItems = 40
   ): Promise<ConversationSummary[]> {
      if (!isPersistentUser(uid)) {
         return [];
      }

      if (!isFirebaseAdminCredentialConfigured()) {
         return this.listTransientConversationSummaries(uid);
      }

      try {
         const snapshot = await firebaseAdminDb
            .collection(`users/${uid}/conversations`)
            .orderBy('updatedAt', 'desc')
            .limit(maxItems)
            .get();

         return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
               conversationId: doc.id,
               title: String(data.title || 'New conversation'),
               lastMessage: String(data.lastMessage || ''),
               createdAt: toIsoTimestamp(data.createdAt),
               updatedAt: toIsoTimestamp(data.updatedAt),
            };
         });
      } catch (error) {
         this.logFirestoreFallback(error);
         return this.listTransientConversationSummaries(uid);
      }
   }
}

export const conversationRepository = new ConversationRepository();
