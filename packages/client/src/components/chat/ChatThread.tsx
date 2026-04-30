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

type ChatStreamEvent =
   | { type: 'conversation'; conversationId: string }
   | { type: 'delta'; delta: string }
   | { type: 'done'; message: string; conversationId: string }
   | { type: 'error'; error: string };

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

function wait(ms: number) {
   return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
   });
}

function hasPreviousUserMessage(
   items: ChatMessageProps[],
   assistantIndex: number
): boolean {
   for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (
         items[index].role === 'user' &&
         items[index].content.trim().length > 0
      ) {
         return true;
      }
   }

   return false;
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

async function requestChatReplyStream(
   prompt: string,
   conversationId: string,
   {
      idToken,
      projectId,
      templateRun,
      signal,
      onConversation,
      onDelta,
   }: {
      idToken?: string;
      projectId?: string | null;
      templateRun?: TemplateRunPayload | null;
      signal?: AbortSignal;
      onConversation?: (nextConversationId: string) => void;
      onDelta?: (delta: string, fullMessage: string) => void;
   }
): Promise<ChatApiResponse> {
   const headers: Record<string, string> = {
      'Content-Type': 'application/json',
   };
   if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
   }

   let response: Response;
   try {
      response = await fetch('/api/chat/stream', {
         method: 'POST',
         headers,
         body: JSON.stringify({
            prompt,
            conversationId,
            projectId: projectId || undefined,
            templateRun: templateRun || undefined,
         }),
         signal,
      });
   } catch {
      throw new Error(
         'Cannot reach chat API. Start the backend server on http://localhost:3000 and try again.'
      );
   }

   if (!response.ok) {
      const rawPayload = await response.text();
      const data = rawPayload ? safeParseJson(rawPayload) : null;
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

   if (!response.body) {
      throw new Error('Chat API did not return a readable stream.');
   }

   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   let buffer = '';
   let fullMessage = '';
   let resolvedConversationId = conversationId;

   const handleEvent = (event: ChatStreamEvent) => {
      if (event.type === 'conversation') {
         resolvedConversationId = event.conversationId;
         onConversation?.(event.conversationId);
         return;
      }

      if (event.type === 'delta') {
         fullMessage += event.delta;
         onDelta?.(event.delta, fullMessage);
         return;
      }

      if (event.type === 'done') {
         resolvedConversationId = event.conversationId;
         fullMessage = event.message || fullMessage;
         return;
      }

      throw new Error(event.error || 'Something went wrong while streaming.');
   };

   const flushBuffer = () => {
      buffer = buffer.replace(/\r\n/g, '\n');

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex >= 0) {
         const rawEvent = buffer.slice(0, separatorIndex);
         buffer = buffer.slice(separatorIndex + 2);

         const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

         if (dataLines.length > 0) {
            const payload = dataLines.join('\n');
            const parsed = safeParseJson(payload);
            if (parsed && typeof parsed === 'object' && 'type' in parsed) {
               handleEvent(parsed as ChatStreamEvent);
            }
         }

         separatorIndex = buffer.indexOf('\n\n');
      }
   };

   while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      flushBuffer();

      if (done) {
         break;
      }
   }

   if (buffer.trim()) {
      buffer += '\n\n';
      flushBuffer();
   }

   return {
      message:
         fullMessage.trim() || "I couldn't generate a response this time.",
      conversationId: resolvedConversationId,
   };
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
   const streamAbortRef = useRef<AbortController | null>(null);

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

   const animateAssistantMessage = async (
      messageId: string,
      fullText: string
   ) => {
      if (!fullText.trim()) {
         setMessages((current) =>
            current.map((item) =>
               item.id === messageId ? { ...item, content: fullText } : item
            )
         );
         return;
      }

      const chunkSize =
         fullText.length > 240 ? 8 : fullText.length > 120 ? 5 : 3;
      for (let index = chunkSize; index < fullText.length; index += chunkSize) {
         const nextSlice = fullText.slice(0, index);
         setMessages((current) =>
            current.map((item) =>
               item.id === messageId ? { ...item, content: nextSlice } : item
            )
         );
         await wait(18);
      }

      setMessages((current) =>
         current.map((item) =>
            item.id === messageId ? { ...item, content: fullText } : item
         )
      );
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
      return () => {
         streamAbortRef.current?.abort();
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

   const sendPrompt = async (
      msg: string,
      options?: {
         appendUserMessage?: boolean;
         countAsQuestion?: boolean;
         replaceAssistantMessageId?: string;
      }
   ) => {
      const appendUserMessage = options?.appendUserMessage ?? true;
      const countAsQuestion = options?.countAsQuestion ?? appendUserMessage;
      const replaceAssistantMessageId = options?.replaceAssistantMessageId;

      if (isSending || isHistoryLoading) {
         return;
      }

      if (
         appendUserMessage &&
         !currentUserId &&
         guestQuestionsAsked >= GUEST_LIMIT
      ) {
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
      const streamingAssistantMessageId = createLocalMessageId('assistant');
      setMessages((current) => {
         if (replaceAssistantMessageId) {
            return current.map((item) =>
               item.id === replaceAssistantMessageId
                  ? {
                       ...item,
                       id: streamingAssistantMessageId,
                       content: '',
                       createdAt: new Date().toISOString(),
                    }
                  : item
            );
         }

         return [
            ...current,
            {
               id: createLocalMessageId('user'),
               role: 'user',
               content: msg,
               createdAt: new Date().toISOString(),
            },
            {
               id: streamingAssistantMessageId,
               role: 'assistant',
               content: '',
               createdAt: new Date().toISOString(),
            },
         ];
      });
      setIsSending(true);
      if (countAsQuestion) {
         onQuestionAsked();
      }

      if (countAsQuestion && !currentUserId) {
         const nextCount = guestQuestionsAsked + 1;
         setGuestQuestionsAsked(nextCount);
         setGuestQuestionCount(nextCount);
      }

      try {
         let result: ChatApiResponse;

         if (!currentUserId) {
            result = await requestChatReply(
               msg,
               conversationId,
               undefined,
               currentProjectId,
               pendingTemplateRun
            );

            const assistantContent =
               result.message?.trim() ||
               "I couldn't generate a response this time.";

            setConversationId(result.conversationId);
            if (pendingTemplateRun) {
               onTemplateRunAttached?.();
            }
            await animateAssistantMessage(
               streamingAssistantMessageId,
               assistantContent
            );
            setMessages((current) =>
               current.map((item) =>
                  item.id === streamingAssistantMessageId
                     ? {
                          ...item,
                          content: assistantContent,
                          createdAt: new Date().toISOString(),
                       }
                     : item
               )
            );
            playResponseSound();
            return;
         }

         const abortController = new AbortController();
         streamAbortRef.current = abortController;

         try {
            result = await requestChatReplyStream(msg, conversationId, {
               idToken,
               projectId: currentProjectId,
               templateRun: pendingTemplateRun,
               signal: abortController.signal,
               onConversation: (nextConversationId) => {
                  setConversationId(nextConversationId);
               },
               onDelta: (_delta, fullMessage) => {
                  setMessages((current) =>
                     current.map((item) =>
                        item.id === streamingAssistantMessageId
                           ? { ...item, content: fullMessage }
                           : item
                     )
                  );
               },
            });
         } catch (err) {
            const isMissingConversation =
               err instanceof Error &&
               err.message.toLowerCase().includes('conversation not found') &&
               Boolean(conversationId);

            if (!isMissingConversation) {
               if (err instanceof Error && err.name === 'AbortError') {
                  return;
               }

               result = await requestChatReply(
                  msg,
                  conversationId,
                  idToken,
                  currentProjectId,
                  pendingTemplateRun
               );
               setMessages((current) =>
                  current.map((item) =>
                     item.id === streamingAssistantMessageId
                        ? {
                             ...item,
                             content:
                                result.message?.trim() ||
                                "I couldn't generate a response this time.",
                             createdAt: new Date().toISOString(),
                          }
                        : item
                  )
               );
               setConversationId(result.conversationId);
               if (currentUserId) {
                  onConversationResolved(result.conversationId);
                  onConversationUpdated();
               }
               if (pendingTemplateRun) {
                  onTemplateRunAttached?.();
               }
               playResponseSound();
               return;
            }

            result = await requestChatReplyStream(msg, '', {
               idToken,
               projectId: currentProjectId,
               templateRun: pendingTemplateRun,
               signal: abortController.signal,
               onConversation: (nextConversationId) => {
                  setConversationId(nextConversationId);
               },
               onDelta: (_delta, fullMessage) => {
                  setMessages((current) =>
                     current.map((item) =>
                        item.id === streamingAssistantMessageId
                           ? { ...item, content: fullMessage }
                           : item
                     )
                  );
               },
            });
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
         setMessages((current) =>
            current.map((item) =>
               item.id === streamingAssistantMessageId
                  ? {
                       ...item,
                       content: assistantContent,
                       createdAt: new Date().toISOString(),
                    }
                  : item
            )
         );
         playResponseSound();
      } catch (err) {
         if (err instanceof Error && err.name === 'AbortError') {
            return;
         }

         const message =
            err instanceof Error
               ? err.message
               : 'Something went wrong while contacting the chat API.';

         setError(message);
         setMessages((current) =>
            current.map((item) =>
               item.id === streamingAssistantMessageId
                  ? {
                       ...item,
                       content:
                          item.content.trim().length > 0
                             ? item.content
                             : 'I hit a server issue while answering. Please try again in a moment.',
                       createdAt: new Date().toISOString(),
                    }
                  : item
            )
         );
      } finally {
         streamAbortRef.current = null;
         setIsSending(false);
      }
   };

   const handleSend = async (msg: string) => {
      await sendPrompt(msg);
   };

   const handleRetry = async (assistantMessageId: string) => {
      const assistantIndex = messages.findIndex(
         (item) => item.id === assistantMessageId
      );
      if (assistantIndex < 0) {
         return;
      }

      let promptToRetry: string | null = null;
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
         const candidate = messages[index];
         if (candidate.role === 'user' && candidate.content.trim().length > 0) {
            promptToRetry = candidate.content;
            break;
         }
      }

      if (!promptToRetry) {
         return;
      }

      await sendPrompt(promptToRetry, {
         appendUserMessage: false,
         countAsQuestion: false,
         replaceAssistantMessageId: assistantMessageId,
      });
   };

   const latestAssistantMessageId = useMemo(() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
         const item = messages[index];
         if (item.role === 'assistant') {
            return item.id || null;
         }
      }

      return null;
   }, [messages]);

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
                  showActions={msg.role === 'assistant'}
                  canRetry={
                     !isSending &&
                     msg.role === 'assistant' &&
                     msg.id === latestAssistantMessageId &&
                     hasPreviousUserMessage(messages, i)
                  }
                  onRetry={() => {
                     if (msg.id) {
                        void handleRetry(msg.id);
                     }
                  }}
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
