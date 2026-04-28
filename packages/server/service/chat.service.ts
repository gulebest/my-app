import { z } from 'zod';
import OpenAI from 'openai';
import { conversationRepository } from '../repository/conversation.repository';
import type { ChatMessage } from '../repository/conversation.repository';

const chatRequestSchema = z.object({
   prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(1000, 'Prompt is too long (max 1000 characters)'),
   conversationId: z.string().trim().optional(),
   userId: z.string().trim().optional(),
});

const client = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY,
   baseURL: 'https://openrouter.ai/api/v1',
   defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'My App',
   },
});

function createConversationId() {
   if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
   ) {
      return crypto.randomUUID();
   }
   return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class ChatService {
   validateRequest(body: any) {
      return chatRequestSchema.safeParse(body);
   }

   getConversationKey(userId?: string, conversationId?: string) {
      const userKey = userId && userId.length > 0 ? userId : 'anonymous';
      return `${userKey}:${conversationId}`;
   }

   ensureConversation(
      conversationId: string | undefined,
      userId: string | undefined
   ) {
      if (conversationId && conversationId.trim() !== '') {
         const key = this.getConversationKey(userId, conversationId);
         if (!conversationRepository.conversationExists(key)) {
            return { error: 'Conversation not found' };
         }
         return { key, conversationId };
      } else {
         const newId = createConversationId();
         const key = this.getConversationKey(userId, newId);
         return { key, conversationId: newId };
      }
   }

   async chat(prompt: string, conversationId: string, userId: string) {
      const key = this.getConversationKey(userId, conversationId);
      let conversation = conversationRepository.getConversation(key) ?? [];
      conversation.push({ role: 'user', content: prompt });

      let response;
      try {
         response = await client.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: conversation,
            temperature: 0.2,
            max_tokens: 100,
         });
      } catch (aiError) {
         throw { type: 'ai', error: aiError };
      }

      const message = response.choices?.[0]?.message?.content ?? '';
      if (message) {
         conversation.push({ role: 'assistant', content: message });
      }
      conversationRepository.saveConversation(key, conversation);
      return { message };
   }

   async *chatStream(prompt: string, conversationId: string, userId: string) {
      const key = this.getConversationKey(userId, conversationId);
      const conversation = conversationRepository.getConversation(key) ?? [];
      conversation.push({ role: 'user', content: prompt });

      let stream;
      try {
         stream = await client.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: conversation,
            temperature: 0.2,
            max_tokens: 300,
            stream: true,
         });
      } catch (aiError) {
         throw { type: 'ai', error: aiError };
      }

      let fullMessage = '';
      for await (const chunk of stream) {
         const delta = chunk.choices?.[0]?.delta?.content;
         if (!delta) {
            continue;
         }
         fullMessage += delta;
         yield delta;
      }

      if (fullMessage.trim().length > 0) {
         conversation.push({ role: 'assistant', content: fullMessage });
      }
      conversationRepository.saveConversation(key, conversation);
   }
}
