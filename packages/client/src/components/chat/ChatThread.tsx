import { useEffect, useMemo, useState } from 'react';
import { ChatMessage, type ChatMessageProps } from './ChatMessage';
import { ChatInputBar } from './ChatInputBar';
import type { AuthUser } from '../../lib/auth-storage';
import {
   loadConversationById,
   loadLatestConversation,
} from '../../lib/firestore-chat';
import { auth } from '../../lib/firebase';
import { isFirestorePermissionDenied } from '../../lib/firebase-errors';

interface ChatApiResponse {
   message: string;
   conversationId: string;
}

interface ChatThreadProps {
   currentUser: AuthUser | null;
   activeConversationId: string | null;
   shouldLoadLatestConversation: boolean;
   onConversationResolved: (conversationId: string) => void;
   onConversationUpdated: () => void;
}

const initialMessages: ChatMessageProps[] = [
   {
      role: 'assistant',
      content: 'Hi! Ask me anything and I will respond using the live backend.',
   },
];

const GUEST_LIMIT = 20;
const GUEST_COUNT_KEY = 'assistly-guest-question-count';

function getGuestQuestionCount() {
   try {
      const raw = window.localStorage.getItem(GUEST_COUNT_KEY);
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
   } catch {
      return 0;
   }
}

function setGuestQuestionCount(value: number) {
   window.localStorage.setItem(GUEST_COUNT_KEY, String(value));
}

function safeParseJson(payload: string): unknown {
   try {
      return JSON.parse(payload);
   } catch {
      return null;
   }
}

async function requestChatReply(
   prompt: string,
   conversationId: string,
   idToken?: string
): Promise<ChatApiResponse> {
   const headers: Record<string, string> = {
      'Content-Type': 'application/json',
   };
   if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
   }

   let response: Response;
   try {
      response = await fetch('/api/chat', {
         method: 'POST',
         headers,
         body: JSON.stringify({ prompt, conversationId }),
      });
   } catch {
      throw new Error(
         'Cannot reach chat API. Start the backend server on http://localhost:3000 and try again.'
      );
   }

   const rawPayload = await response.text();
   const data = rawPayload ? safeParseJson(rawPayload) : null;

   if (!response.ok) {
      const apiMessage =
         typeof data === 'object' && data && 'error' in data
            ? String((data as { error?: string }).error || '')
            : '';

      if (response.status === 502 || response.status === 503) {
         throw new Error(
            'Chat API is unavailable right now. Start the backend server on http://localhost:3000 and try again.'
         );
      }

      throw new Error(apiMessage || `Request failed (${response.status})`);
   }

   if (
      !data ||
      typeof data !== 'object' ||
      !('message' in data) ||
      !('conversationId' in data)
   ) {
      throw new Error('Chat API returned an invalid response format.');
   }

   return data as ChatApiResponse;
}

export function ChatThread({
   currentUser,
   activeConversationId,
   shouldLoadLatestConversation,
   onConversationResolved,
   onConversationUpdated,
}: ChatThreadProps) {
   const [messages, setMessages] = useState(initialMessages);
   const [conversationId, setConversationId] = useState('');
   const [isSending, setIsSending] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isHistoryLoading, setIsHistoryLoading] = useState(false);
   const [guestQuestionsAsked, setGuestQuestionsAsked] = useState(() =>
      getGuestQuestionCount()
   );

   const currentUserId = useMemo(() => currentUser?.uid || null, [currentUser]);

   useEffect(() => {
      let cancelled = false;

      async function loadHistory() {
         setError(null);

         if (!currentUserId) {
            setMessages(initialMessages);
            setConversationId('');
            return;
         }

         setIsHistoryLoading(true);
         try {
            const loaded = activeConversationId
               ? await loadConversationById(currentUserId, activeConversationId)
               : shouldLoadLatestConversation
                 ? await loadLatestConversation(currentUserId)
                 : null;

            if (cancelled) {
               return;
            }

            if (!loaded || loaded.messages.length === 0) {
               setMessages((current) => {
                  const hasUserContent = current.some(
                     (item) =>
                        item.role === 'user' && item.content.trim().length > 0
                  );

                  if (activeConversationId && hasUserContent) {
                     return current;
                  }

                  return initialMessages;
               });
               setConversationId(activeConversationId || '');
               return;
            }

            setConversationId(loaded.conversationId);
            setMessages(loaded.messages);
            if (currentUserId) {
               onConversationResolved(loaded.conversationId);
            }
         } catch (err) {
            if (!isFirestorePermissionDenied(err)) {
               console.error('Failed to load chat history', err);
            }
            if (!cancelled) {
               setMessages(initialMessages);
            }
         } finally {
            if (!cancelled) {
               setIsHistoryLoading(false);
            }
         }
      }

      void loadHistory();

      return () => {
         cancelled = true;
      };
   }, [
      activeConversationId,
      currentUserId,
      onConversationResolved,
      shouldLoadLatestConversation,
   ]);

   const handleSend = async (msg: string) => {
      if (isSending || isHistoryLoading) {
         return;
      }

      if (!currentUserId && guestQuestionsAsked >= GUEST_LIMIT) {
         setError(
            'Guest limit reached (20 questions). Please sign in or create an account to continue.'
         );
         setMessages((current) => [
            ...current,
            {
               role: 'assistant',
               content:
                  'You have reached the 20-question guest limit. Please sign in or create an account to continue.',
            },
         ]);
         return;
      }

      let idToken: string | undefined;
      if (currentUserId) {
         idToken = await auth.currentUser?.getIdToken();
         if (!idToken) {
            setError('Authentication expired. Please sign in again.');
            return;
         }
      }

      setError(null);
      setMessages((current) => [...current, { role: 'user', content: msg }]);
      setIsSending(true);

      if (!currentUserId) {
         const nextCount = guestQuestionsAsked + 1;
         setGuestQuestionsAsked(nextCount);
         setGuestQuestionCount(nextCount);
      }

      try {
         let result: ChatApiResponse;

         try {
            result = await requestChatReply(msg, conversationId, idToken);
         } catch (err) {
            const isMissingConversation =
               err instanceof Error &&
               err.message.toLowerCase().includes('conversation not found') &&
               Boolean(conversationId);

            if (!isMissingConversation) {
               throw err;
            }

            result = await requestChatReply(msg, '', idToken);
         }

         const assistantContent =
            result.message?.trim() ||
            "I couldn't generate a response this time.";

         setConversationId(result.conversationId);
         if (currentUserId) {
            onConversationResolved(result.conversationId);
            onConversationUpdated();
         }
         setMessages((current) => [
            ...current,
            {
               role: 'assistant',
               content: assistantContent,
            },
         ]);
      } catch (err) {
         const message =
            err instanceof Error
               ? err.message
               : 'Something went wrong while contacting the chat API.';

         setError(message);
         setMessages((current) => [
            ...current,
            {
               role: 'assistant',
               content:
                  'I hit a server issue while answering. Please try again in a moment.',
            },
         ]);
      } finally {
         setIsSending(false);
      }
   };

   return (
      <div className="flex min-h-0 flex-1 flex-col">
         <div className="app-scroll min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
            {messages.map((msg, i) => (
               <ChatMessage key={i} {...msg} />
            ))}
         </div>
         {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
               {error}
            </p>
         )}
         <ChatInputBar
            onSend={handleSend}
            disabled={isSending || isHistoryLoading}
         />
      </div>
   );
}
