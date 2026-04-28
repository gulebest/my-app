// Conversation Repository: Handles all conversation data storage/retrieval

export type ChatMessage = {
   role: 'system' | 'user' | 'assistant';
   content: string;
};

class ConversationRepository {
   private conversations = new Map<string, ChatMessage[]>();

   getConversation(key: string): ChatMessage[] | undefined {
      return this.conversations.get(key);
   }

   saveConversation(key: string, conversation: ChatMessage[]): void {
      this.conversations.set(key, conversation);
   }

   conversationExists(key: string): boolean {
      return this.conversations.has(key);
   }
}

export const conversationRepository = new ConversationRepository();
