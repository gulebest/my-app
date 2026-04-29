export interface ConversationSummary {
   conversationId: string;
   title: string;
   lastMessage: string;
   createdAt: string | null;
   updatedAt: string | null;
}

interface ConversationHistoryResponse {
   conversations: ConversationSummary[];
}

export class ApiRequestError extends Error {
   status: number;

   constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiRequestError';
      this.status = status;
   }
}

export async function fetchConversationHistory(
   idToken: string
): Promise<ConversationSummary[]> {
   const response = await fetch('/api/conversations', {
      headers: {
         Authorization: `Bearer ${idToken}`,
      },
   });

   const data = (await response.json()) as
      | ConversationHistoryResponse
      | { error?: string };

   if (!response.ok) {
      const message =
         typeof data === 'object' && data && 'error' in data
            ? String(data.error || '')
            : undefined;
      const details =
         typeof data === 'object' && data && 'details' in data
            ? String((data as { details?: string }).details || '')
            : '';

      const finalMessage =
         message ||
         details ||
         `Failed to fetch conversation history (${response.status})`;
      throw new ApiRequestError(finalMessage, response.status);
   }

   if (
      !data ||
      typeof data !== 'object' ||
      !('conversations' in data) ||
      !Array.isArray(data.conversations)
   ) {
      throw new Error('Invalid conversation history response format.');
   }

   return data.conversations;
}
