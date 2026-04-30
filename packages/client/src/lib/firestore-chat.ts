import {
   addDoc,
   collection,
   doc,
   getDocs,
   limit,
   orderBy,
   query,
   serverTimestamp,
   setDoc,
   where,
   type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { isFirestorePermissionDenied } from './firebase-errors';

export interface PersistedMessage {
   id: string;
   role: 'user' | 'assistant';
   content: string;
   createdAt?: string | null;
}

interface LoadedConversation {
   conversationId: string;
   messages: PersistedMessage[];
}

function messageRoleOrder(role: unknown) {
   return role === 'assistant' ? 1 : 0;
}

function messageSortNumber(value: unknown) {
   return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.MAX_SAFE_INTEGER;
}

function sortLoadedMessages(
   docs: Array<{ id: string; data: DocumentData }>
): PersistedMessage[] {
   return docs
      .map((messageDoc, index) => {
         const item = messageDoc.data;
         const createdAt =
            item.createdAt &&
            typeof item.createdAt.toDate === 'function' &&
            item.createdAt.toDate() instanceof Date
               ? item.createdAt.toDate().toISOString()
               : null;

         return {
            id: messageDoc.id,
            role: item.role as 'user' | 'assistant',
            content: String(item.content || ''),
            createdAt,
            _sortIndex: index,
            _turnIndex: messageSortNumber(item.turnIndex),
            _messageIndex: messageSortNumber(item.messageIndex),
         };
      })
      .filter(
         (item) =>
            (item.role === 'user' || item.role === 'assistant') &&
            item.content.trim().length > 0
      )
      .sort((left, right) => {
         if (left._turnIndex !== right._turnIndex) {
            return left._turnIndex - right._turnIndex;
         }

         if (left._messageIndex !== right._messageIndex) {
            return left._messageIndex - right._messageIndex;
         }

         const leftTime = left.createdAt
            ? new Date(left.createdAt).getTime()
            : 0;
         const rightTime = right.createdAt
            ? new Date(right.createdAt).getTime()
            : 0;
         if (leftTime !== rightTime) {
            return leftTime - rightTime;
         }

         const roleDelta =
            messageRoleOrder(left.role) - messageRoleOrder(right.role);
         if (roleDelta !== 0) {
            return roleDelta;
         }

         return left._sortIndex - right._sortIndex;
      })
      .map(({ _messageIndex, _sortIndex, _turnIndex, ...message }) => message);
}

function conversationDoc(uid: string, conversationId: string) {
   return doc(db, 'users', uid, 'conversations', conversationId);
}

function messagesCol(uid: string, conversationId: string) {
   return collection(
      db,
      'users',
      uid,
      'conversations',
      conversationId,
      'messages'
   );
}

export async function loadLatestConversation(
   uid: string,
   projectId?: string | null
): Promise<LoadedConversation | null> {
   try {
      const conversationsRef = collection(db, 'users', uid, 'conversations');
      const latestQuery = projectId
         ? query(
              conversationsRef,
              where('projectId', '==', projectId),
              orderBy('updatedAt', 'desc'),
              limit(1)
           )
         : query(conversationsRef, orderBy('updatedAt', 'desc'), limit(1));
      const latestSnapshot = await getDocs(latestQuery);

      if (latestSnapshot.empty) {
         return null;
      }

      const latestConversation = latestSnapshot.docs[0];
      const conversationId = latestConversation.id;

      const messageQuery = query(
         messagesCol(uid, conversationId),
         orderBy('createdAt', 'asc')
      );
      const messageSnapshot = await getDocs(messageQuery);

      const messages = sortLoadedMessages(
         messageSnapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            data: messageDoc.data() as DocumentData,
         }))
      );

      return {
         conversationId,
         messages,
      };
   } catch (error) {
      if (isFirestorePermissionDenied(error)) {
         return null;
      }
      throw error;
   }
}

export async function loadConversationById(
   uid: string,
   conversationId: string
): Promise<LoadedConversation | null> {
   try {
      const messageQuery = query(
         messagesCol(uid, conversationId),
         orderBy('createdAt', 'asc')
      );
      const messageSnapshot = await getDocs(messageQuery);

      if (messageSnapshot.empty) {
         return null;
      }

      const messages = sortLoadedMessages(
         messageSnapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            data: messageDoc.data() as DocumentData,
         }))
      );

      return {
         conversationId,
         messages,
      };
   } catch (error) {
      if (isFirestorePermissionDenied(error)) {
         return null;
      }
      throw error;
   }
}

export async function saveConversationMessages(params: {
   uid: string;
   conversationId: string;
   userPrompt: string;
   assistantReply: string;
}) {
   const { uid, conversationId, userPrompt, assistantReply } = params;

   try {
      await setDoc(
         conversationDoc(uid, conversationId),
         {
            title: userPrompt.slice(0, 80),
            lastMessage: assistantReply.slice(0, 180),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
         },
         { merge: true }
      );

      const existingMessages = await getDocs(messagesCol(uid, conversationId));
      const nextTurnIndex = Math.floor(existingMessages.size / 2);

      await addDoc(messagesCol(uid, conversationId), {
         role: 'user',
         content: userPrompt,
         turnIndex: nextTurnIndex,
         messageIndex: 0,
         createdAt: serverTimestamp(),
      });

      await addDoc(messagesCol(uid, conversationId), {
         role: 'assistant',
         content: assistantReply,
         turnIndex: nextTurnIndex,
         messageIndex: 1,
         createdAt: serverTimestamp(),
      });
   } catch (error) {
      if (isFirestorePermissionDenied(error)) {
         return;
      }
      throw error;
   }
}
