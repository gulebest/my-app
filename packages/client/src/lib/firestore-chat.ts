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
   type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { isFirestorePermissionDenied } from './firebase-errors';

export interface PersistedMessage {
   role: 'user' | 'assistant';
   content: string;
}

interface LoadedConversation {
   conversationId: string;
   messages: PersistedMessage[];
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
   uid: string
): Promise<LoadedConversation | null> {
   try {
      const conversationsRef = collection(db, 'users', uid, 'conversations');
      const latestQuery = query(
         conversationsRef,
         orderBy('updatedAt', 'desc'),
         limit(1)
      );
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

      const messages = messageSnapshot.docs
         .map((messageDoc) => messageDoc.data() as DocumentData)
         .filter((item) => item.role === 'user' || item.role === 'assistant')
         .map((item) => ({
            role: item.role as 'user' | 'assistant',
            content: String(item.content || ''),
         }))
         .filter((item) => item.content.trim().length > 0);

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

      const messages = messageSnapshot.docs
         .map((messageDoc) => messageDoc.data() as DocumentData)
         .filter((item) => item.role === 'user' || item.role === 'assistant')
         .map((item) => ({
            role: item.role as 'user' | 'assistant',
            content: String(item.content || ''),
         }))
         .filter((item) => item.content.trim().length > 0);

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

      await addDoc(messagesCol(uid, conversationId), {
         role: 'user',
         content: userPrompt,
         createdAt: serverTimestamp(),
      });

      await addDoc(messagesCol(uid, conversationId), {
         role: 'assistant',
         content: assistantReply,
         createdAt: serverTimestamp(),
      });
   } catch (error) {
      if (isFirestorePermissionDenied(error)) {
         return;
      }
      throw error;
   }
}
