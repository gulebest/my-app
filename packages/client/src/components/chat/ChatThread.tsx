import { useState } from 'react';
import { ChatMessage, type ChatMessageProps } from './ChatMessage';
import { ChatInputBar } from './ChatInputBar';

interface ChatApiResponse {
   message: string;
   conversationId: string;
}

const initialMessages: ChatMessageProps[] = [
   {
      role: 'assistant',
      content: 'Hi! Ask me anything and I will respond using the live backend.',
   },
];

async function requestChatReply(
   prompt: string,
   conversationId: string
): Promise<ChatApiResponse> {
   const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, conversationId }),
   });

   const data = (await response.json()) as ChatApiResponse | { error?: string };

   if (!response.ok) {
      const apiMessage =
         typeof data === 'object' && data && 'error' in data ? data.error : '';
      throw new Error(apiMessage || `Request failed (${response.status})`);
   }

   return data as ChatApiResponse;
}

export function ChatThread() {
   const [messages, setMessages] = useState(initialMessages);
   const [conversationId, setConversationId] = useState('');
   const [isSending, setIsSending] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const handleSend = async (msg: string) => {
      if (isSending) {
         return;
      }

      setError(null);
      setMessages((current) => [...current, { role: 'user', content: msg }]);
      setIsSending(true);

      try {
         let result: ChatApiResponse;

         try {
            result = await requestChatReply(msg, conversationId);
         } catch (err) {
            const isMissingConversation =
               err instanceof Error &&
               err.message.toLowerCase().includes('conversation not found') &&
               Boolean(conversationId);

            if (!isMissingConversation) {
               throw err;
            }

            result = await requestChatReply(msg, '');
         }

         setConversationId(result.conversationId);
         setMessages((current) => [
            ...current,
            {
               role: 'assistant',
               content:
                  result.message?.trim() ||
                  "I couldn't generate a response this time.",
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
         <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
            {messages.map((msg, i) => (
               <ChatMessage key={i} {...msg} />
            ))}
         </div>
         {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
               {error}
            </p>
         )}
         <ChatInputBar onSend={handleSend} disabled={isSending} />
      </div>
   );
}
