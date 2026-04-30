export interface ConversationExportMessage {
   role: 'user' | 'assistant' | 'system';
   content: string;
   createdAt: string | null;
}

export interface ConversationExportItem {
   conversationId: string;
   title: string;
   lastMessage: string;
   createdAt: string | null;
   updatedAt: string | null;
   messages: ConversationExportMessage[];
}

export async function exportConversationsAsJson(
   idToken: string
): Promise<ConversationExportItem[]> {
   const response = await fetch('/api/conversations/export?format=json', {
      headers: {
         Authorization: `Bearer ${idToken}`,
      },
   });

   const data = (await response.json()) as
      | { conversations: ConversationExportItem[] }
      | { error?: string };
   if (!response.ok) {
      const message =
         typeof data === 'object' && data && 'error' in data
            ? data.error
            : 'Failed to export conversations';
      throw new Error(message || 'Failed to export conversations');
   }

   if (
      !data ||
      typeof data !== 'object' ||
      !('conversations' in data) ||
      !Array.isArray(data.conversations)
   ) {
      throw new Error('Invalid conversations export payload');
   }

   return data.conversations;
}

export async function exportConversationsAsCsv(
   idToken: string
): Promise<string> {
   const response = await fetch('/api/conversations/export?format=csv', {
      headers: {
         Authorization: `Bearer ${idToken}`,
      },
   });

   const csv = await response.text();
   if (!response.ok) {
      throw new Error(csv || 'Failed to export CSV');
   }
   return csv;
}

export async function deleteAllConversations(idToken: string): Promise<void> {
   const response = await fetch('/api/conversations', {
      method: 'DELETE',
      headers: {
         Authorization: `Bearer ${idToken}`,
      },
   });

   if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
         error?: string;
      };
      throw new Error(payload.error || 'Failed to delete conversations');
   }
}

export async function deleteAccount(idToken: string): Promise<void> {
   const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: {
         Authorization: `Bearer ${idToken}`,
      },
   });

   if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
         error?: string;
      };
      throw new Error(payload.error || 'Failed to delete account');
   }
}

export function downloadTextFile(filename: string, content: string) {
   const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const anchor = document.createElement('a');
   anchor.href = url;
   anchor.download = filename;
   anchor.click();
   URL.revokeObjectURL(url);
}

export function toPrettyJson(content: unknown) {
   return JSON.stringify(content, null, 2);
}
