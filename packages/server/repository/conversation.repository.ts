export type ChatMessage = {
   id?: string;
   role: 'system' | 'user' | 'assistant';
   content: string;
};

export type ConversationSummary = {
   conversationId: string;
   title: string;
   lastMessage: string;
   projectId: string | null;
   lastTemplateId: string | null;
   lastTemplateTitle: string | null;
   lastTemplateVersion: number | null;
   createdAt: string | null;
   updatedAt: string | null;
};

export type ConversationExportMessage = {
   id?: string;
   role: 'system' | 'user' | 'assistant';
   content: string;
   createdAt: string | null;
};

export type ConversationExportItem = ConversationSummary & {
   messages: ConversationExportMessage[];
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

function toSortableNumber(value: unknown) {
   return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.MAX_SAFE_INTEGER;
}

function roleOrder(role: unknown) {
   return role === 'assistant' ? 1 : 0;
}

type SortableStoredMessage = {
   id: string;
   role: ChatMessage['role'];
   content: string;
   createdAt: string | null;
   turnIndex?: number;
   messageIndex?: number;
   originalIndex: number;
};

function sortMessages(messages: SortableStoredMessage[]) {
   return messages.sort((left, right) => {
      const leftTurn = toSortableNumber(left.turnIndex);
      const rightTurn = toSortableNumber(right.turnIndex);
      if (leftTurn !== rightTurn) {
         return leftTurn - rightTurn;
      }

      const leftMessageIndex = toSortableNumber(left.messageIndex);
      const rightMessageIndex = toSortableNumber(right.messageIndex);
      if (leftMessageIndex !== rightMessageIndex) {
         return leftMessageIndex - rightMessageIndex;
      }

      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt
         ? new Date(right.createdAt).getTime()
         : 0;
      if (leftTime !== rightTime) {
         return leftTime - rightTime;
      }

      const roleDelta = roleOrder(left.role) - roleOrder(right.role);
      if (roleDelta !== 0) {
         return roleDelta;
      }

      return left.originalIndex - right.originalIndex;
   });
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
      uid: string,
      projectId?: string
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
            projectId: null,
            lastTemplateId: null,
            lastTemplateTitle: null,
            lastTemplateVersion: null,
            createdAt: null,
            updatedAt: null,
         });
      }

      if (!projectId?.trim()) {
         return summaries;
      }

      return summaries.filter((item) => item.projectId === projectId.trim());
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

         return sortMessages(
            snapshot.docs.map((doc, index) => {
               const data = doc.data();

               return {
                  id: doc.id,
                  role: data.role as ChatMessage['role'],
                  content: String(data.content || ''),
                  turnIndex:
                     typeof data.turnIndex === 'number'
                        ? data.turnIndex
                        : undefined,
                  messageIndex:
                     typeof data.messageIndex === 'number'
                        ? data.messageIndex
                        : undefined,
                  createdAt: toIsoTimestamp(data.createdAt),
                  originalIndex: index,
               };
            })
         )
            .filter(
               (item) =>
                  item.role === 'system' ||
                  item.role === 'user' ||
                  item.role === 'assistant'
            )
            .map((item) => ({
               id: typeof item.id === 'string' ? item.id : undefined,
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
      assistantReply: string,
      metadata?: {
         projectId?: string | null;
         templateId?: string | null;
         templateTitle?: string | null;
         templateVersion?: number | null;
      }
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
            const nextTurnIndex = Number(
               existingConversation.data()?.turnCount || 0
            );

            const conversationMetadata = {
               title: currentTitle || userPrompt.slice(0, 80),
               lastMessage: assistantReply.slice(0, 180),
               turnCount: nextTurnIndex + 1,
               projectId:
                  String(existingConversation.data()?.projectId || '').trim() ||
                  metadata?.projectId ||
                  null,
               lastTemplateId: metadata?.templateId || null,
               lastTemplateTitle: metadata?.templateTitle || null,
               lastTemplateVersion: metadata?.templateVersion || null,
               updatedAt: FieldValue.serverTimestamp(),
            };

            if (existingConversation.exists) {
               tx.set(convoRef, conversationMetadata, { merge: true });
            } else {
               tx.set(convoRef, {
                  ...conversationMetadata,
                  createdAt: FieldValue.serverTimestamp(),
               });
            }

            tx.set(userMessageRef, {
               role: 'user',
               content: userPrompt,
               turnIndex: nextTurnIndex,
               messageIndex: 0,
               createdAt: FieldValue.serverTimestamp(),
            });

            tx.set(assistantMessageRef, {
               role: 'assistant',
               content: assistantReply,
               turnIndex: nextTurnIndex,
               messageIndex: 1,
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
      maxItems = 40,
      projectId?: string
   ): Promise<ConversationSummary[]> {
      if (!isPersistentUser(uid)) {
         return [];
      }

      if (!isFirebaseAdminCredentialConfigured()) {
         return this.listTransientConversationSummaries(uid, projectId);
      }

      try {
         let queryRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
            firebaseAdminDb
               .collection(`users/${uid}/conversations`)
               .orderBy('updatedAt', 'desc')
               .limit(maxItems);

         if (projectId && projectId.trim()) {
            queryRef = firebaseAdminDb
               .collection(`users/${uid}/conversations`)
               .where('projectId', '==', projectId.trim())
               .orderBy('updatedAt', 'desc')
               .limit(maxItems);
         }

         const snapshot = await queryRef.get();

         return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
               conversationId: doc.id,
               title: String(data.title || 'New conversation'),
               lastMessage: String(data.lastMessage || ''),
               projectId:
                  typeof data.projectId === 'string' ? data.projectId : null,
               lastTemplateId:
                  typeof data.lastTemplateId === 'string'
                     ? data.lastTemplateId
                     : null,
               lastTemplateTitle:
                  typeof data.lastTemplateTitle === 'string'
                     ? data.lastTemplateTitle
                     : null,
               lastTemplateVersion:
                  typeof data.lastTemplateVersion === 'number'
                     ? data.lastTemplateVersion
                     : null,
               createdAt: toIsoTimestamp(data.createdAt),
               updatedAt: toIsoTimestamp(data.updatedAt),
            };
         });
      } catch (error) {
         this.logFirestoreFallback(error);
         return this.listTransientConversationSummaries(uid, projectId);
      }
   }

   async exportConversations(uid: string): Promise<ConversationExportItem[]> {
      const summaries = await this.listConversations(uid, 1000);
      const exportItems: ConversationExportItem[] = [];

      for (const summary of summaries) {
         const messages = await this.getConversationMessagesForExport(
            uid,
            summary.conversationId
         );
         exportItems.push({
            ...summary,
            messages,
         });
      }

      return exportItems;
   }

   private async getConversationMessagesForExport(
      uid: string,
      conversationId: string
   ): Promise<ConversationExportMessage[]> {
      if (!isPersistentUser(uid) || !isFirebaseAdminCredentialConfigured()) {
         const transient = this.getTransientConversation(uid, conversationId);
         return transient.map((item) => ({
            role: item.role,
            content: item.content,
            createdAt: null,
         }));
      }

      try {
         const snapshot = await messagesCollection(uid, conversationId)
            .orderBy('createdAt', 'asc')
            .get();

         return sortMessages(
            snapshot.docs.map((doc, index) => {
               const data = doc.data();

               return {
                  id: doc.id,
                  role: data.role as ChatMessage['role'],
                  content: String(data.content || ''),
                  turnIndex:
                     typeof data.turnIndex === 'number'
                        ? data.turnIndex
                        : undefined,
                  messageIndex:
                     typeof data.messageIndex === 'number'
                        ? data.messageIndex
                        : undefined,
                  createdAt: toIsoTimestamp(data.createdAt),
                  originalIndex: index,
               };
            })
         )
            .filter(
               (item) =>
                  item.role === 'system' ||
                  item.role === 'user' ||
                  item.role === 'assistant'
            )
            .map((item) => ({
               id: typeof item.id === 'string' ? item.id : undefined,
               role: item.role as ConversationExportMessage['role'],
               content: String(item.content || ''),
               createdAt: item.createdAt || null,
            }));
      } catch (error) {
         this.logFirestoreFallback(error);
         const transient = this.getTransientConversation(uid, conversationId);
         return transient.map((item) => ({
            role: item.role,
            content: item.content,
            createdAt: null,
         }));
      }
   }

   async deleteAllConversations(uid: string): Promise<number> {
      if (!isPersistentUser(uid) || !isFirebaseAdminCredentialConfigured()) {
         const prefix = `${uid}:`;
         let deletedCount = 0;
         for (const key of this.transientConversations.keys()) {
            if (!key.startsWith(prefix)) {
               continue;
            }
            this.transientConversations.delete(key);
            deletedCount += 1;
         }
         return deletedCount;
      }

      try {
         const conversationsSnapshot = await firebaseAdminDb
            .collection(`users/${uid}/conversations`)
            .get();

         for (const conversationDoc of conversationsSnapshot.docs) {
            const messagesSnapshot = await messagesCollection(
               uid,
               conversationDoc.id
            ).get();
            if (!messagesSnapshot.empty) {
               await this.deleteDocumentsInBatches(
                  messagesSnapshot.docs.map((doc) => doc.ref.path)
               );
            }
            await conversationDoc.ref.delete();
         }

         return conversationsSnapshot.size;
      } catch (error) {
         this.logFirestoreFallback(error);
         return 0;
      }
   }

   async deleteUserData(uid: string): Promise<void> {
      await this.deleteAllConversations(uid);

      if (!isPersistentUser(uid) || !isFirebaseAdminCredentialConfigured()) {
         return;
      }

      try {
         await firebaseAdminDb.doc(`users/${uid}`).delete();
      } catch (error) {
         this.logFirestoreFallback(error);
      }
   }

   private async deleteDocumentsInBatches(paths: string[], batchSize = 400) {
      for (let index = 0; index < paths.length; index += batchSize) {
         const batch = firebaseAdminDb.batch();
         const slice = paths.slice(index, index + batchSize);
         for (const path of slice) {
            batch.delete(firebaseAdminDb.doc(path));
         }
         await batch.commit();
      }
   }
}

export const conversationRepository = new ConversationRepository();
