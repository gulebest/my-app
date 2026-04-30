import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage, type ChatMessageProps } from './ChatMessage';
import { ChatInputBar } from './ChatInputBar';
import type { AuthUser } from '../../lib/auth-storage';
import {
   loadConversationById,
   loadLatestConversation,
} from '../../lib/firestore-chat';
import { auth } from '../../lib/firebase';
import { isFirestorePermissionDenied } from '../../lib/firebase-errors';
import type { ChatFontSize } from '../../lib/app-settings';

interface ChatApiResponse {
   message: string;
   conversationId: string;
}

interface TemplateRunPayload {
   templateId?: string;
   templateTitle?: string;
   templateVersion?: number;
}

interface ChatThreadProps {
   currentUser: AuthUser | null;
   currentProjectId?: string | null;
   activeConversationId: string | null;
   shouldLoadLatestConversation: boolean;
   onConversationResolved: (conversationId: string) => void;
   onConversationUpdated: () => void;
   enterToSend: boolean;
   showTimestamps: boolean;
   chatFontSize: ChatFontSize;
   bubbleWidth: number;
   soundOnResponse: boolean;
   muteAllNotifications: boolean;
   onQuestionAsked: () => void;
   prefillMessage?: string;
   prefillNonce?: number;
   pendingTemplateRun?: TemplateRunPayload | null;
   onTemplateRunAttached?: () => void;
}

const initialMessages: ChatMessageProps[] = [
   {
      id: 'assistant-welcome',
      role: 'assistant',
      content: 'Hi! Ask me anything and I will respond using the live backend.',
   },
];

const GUEST_LIMIT = 20;
const GUEST_COUNT_KEY = 'assistly-guest-question-count';
const AUTO_SCROLL_BOTTOM_THRESHOLD = 120;
let localMessageCounter = 0;

function createLocalMessageId(prefix: 'assistant' | 'user') {
   localMessageCounter += 1;
   return `${prefix}-${Date.now()}-${localMessageCounter}`;
}

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
   idToken?: string,
   projectId?: string | null,
   templateRun?: TemplateRunPayload | null
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
         body: JSON.stringify({
            prompt,
            conversationId,
            projectId: projectId || undefined,
            templateRun: templateRun || undefined,
         }),
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
   currentProjectId,
   activeConversationId,
   shouldLoadLatestConversation,
   onConversationResolved,
   onConversationUpdated,
   enterToSend,
   showTimestamps,
   chatFontSize,
   bubbleWidth,
   soundOnResponse,
   muteAllNotifications,
   onQuestionAsked,
   prefillMessage,
   prefillNonce,
   pendingTemplateRun,
   onTemplateRunAttached,
}: ChatThreadProps) {
   const [messages, setMessages] = useState(initialMessages);
   const [conversationId, setConversationId] = useState('');
   const [isSending, setIsSending] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isHistoryLoading, setIsHistoryLoading] = useState(false);
   const [guestQuestionsAsked, setGuestQuestionsAsked] = useState(() =>
      getGuestQuestionCount()
   );
   const scrollViewportRef = useRef<HTMLDivElement | null>(null);
   const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
   const lastAutoScrollMessageCountRef = useRef(0);
   const shouldStickToBottomRef = useRef(true);

   const currentUserId = useMemo(() => currentUser?.uid || null, [currentUser]);

   const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
      const viewport = scrollViewportRef.current;
      if (!viewport) {
         return;
      }

      if (scrollAnchorRef.current) {
         scrollAnchorRef.current.scrollIntoView({
            behavior,
            block: 'end',
         });
         return;
      }

      viewport.scrollTo({
         top: viewport.scrollHeight,
         behavior,
      });
   };

   const updateShouldStickToBottom = () => {
      const viewport = scrollViewportRef.current;
      if (!viewport) {
         shouldStickToBottomRef.current = true;
         return;
      }

      const distanceFromBottom =
         viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottomRef.current =
         distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
   };

   const playResponseSound = () => {
      if (!soundOnResponse || muteAllNotifications) {
         return;
      }

      try {
         const audioContext = new window.AudioContext();
         const oscillator = audioContext.createOscillator();
         const gainNode = audioContext.createGain();
         oscillator.type = 'sine';
         oscillator.frequency.value = 880;
         gainNode.gain.value = 0.03;
         oscillator.connect(gainNode);
         gainNode.connect(audioContext.destination);
         oscillator.start();
         oscillator.stop(audioContext.currentTime + 0.08);
      } catch {
         // ignore audio errors
      }
   };

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
                 ? await loadLatestConversation(currentUserId, currentProjectId)
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
      currentProjectId,
   ]);

   useEffect(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) {
         return;
      }

      updateShouldStickToBottom();
      const handleScroll = () => {
         updateShouldStickToBottom();
      };

      viewport.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
         viewport.removeEventListener('scroll', handleScroll);
      };
   }, []);

   useEffect(() => {
      if (isHistoryLoading) {
         return;
      }

      const nextMessageCount = messages.length;
      const shouldAutoScroll =
         shouldStickToBottomRef.current ||
         nextMessageCount <= 1 ||
         lastAutoScrollMessageCountRef.current === 0;

      lastAutoScrollMessageCountRef.current = nextMessageCount;
      if (!shouldAutoScroll) {
         return;
      }

      const shouldAnimate = nextMessageCount > 1;
      const frame = window.requestAnimationFrame(() => {
         scrollToBottom(shouldAnimate ? 'smooth' : 'auto');
         shouldStickToBottomRef.current = true;
      });

      return () => {
         window.cancelAnimationFrame(frame);
      };
   }, [isHistoryLoading, messages]);

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
               id: createLocalMessageId('assistant'),
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
      setMessages((current) => [
         ...current,
         {
            id: createLocalMessageId('user'),
            role: 'user',
            content: msg,
            createdAt: new Date().toISOString(),
         },
      ]);
      setIsSending(true);
      onQuestionAsked();

      if (!currentUserId) {
         const nextCount = guestQuestionsAsked + 1;
         setGuestQuestionsAsked(nextCount);
         setGuestQuestionCount(nextCount);
      }

      try {
         let result: ChatApiResponse;

         try {
            result = await requestChatReply(
               msg,
               conversationId,
               idToken,
               currentProjectId,
               pendingTemplateRun
            );
         } catch (err) {
            const isMissingConversation =
               err instanceof Error &&
               err.message.toLowerCase().includes('conversation not found') &&
               Boolean(conversationId);

            if (!isMissingConversation) {
               throw err;
            }

            result = await requestChatReply(
               msg,
               '',
               idToken,
               currentProjectId,
               pendingTemplateRun
            );
         }

         const assistantContent =
            result.message?.trim() ||
            "I couldn't generate a response this time.";

         setConversationId(result.conversationId);
         if (currentUserId) {
            onConversationResolved(result.conversationId);
            onConversationUpdated();
         }
         if (pendingTemplateRun) {
            onTemplateRunAttached?.();
         }
         setMessages((current) => [
            ...current,
            {
               id: createLocalMessageId('assistant'),
               role: 'assistant',
               content: assistantContent,
               createdAt: new Date().toISOString(),
            },
         ]);
         playResponseSound();
      } catch (err) {
         const message =
            err instanceof Error
               ? err.message
               : 'Something went wrong while contacting the chat API.';

         setError(message);
         setMessages((current) => [
            ...current,
            {
               id: createLocalMessageId('assistant'),
               role: 'assistant',
               content:
                  'I hit a server issue while answering. Please try again in a moment.',
               createdAt: new Date().toISOString(),
            },
         ]);
      } finally {
         setIsSending(false);
      }
   };

   return (
      <div className="flex min-h-0 flex-1 flex-col">
         <div
            ref={scrollViewportRef}
            className="app-scroll min-h-0 flex-1 overflow-y-auto pb-4 pr-1"
         >
            {messages.map((msg, i) => (
               <ChatMessage
                  key={msg.id || `${msg.role}-${msg.createdAt || i}-${i}`}
                  {...msg}
                  showTimestamp={showTimestamps}
                  fontSize={chatFontSize}
                  bubbleWidth={bubbleWidth}
               />
            ))}
            <div ref={scrollAnchorRef} aria-hidden="true" />
         </div>
         {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
               {error}
            </p>
         )}
         <ChatInputBar
            key={`chat-input-${prefillNonce || 0}`}
            onSend={handleSend}
            disabled={isSending || isHistoryLoading}
            enterToSend={enterToSend}
            initialValue={prefillMessage}
         />
      </div>
   );
}
