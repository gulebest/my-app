import { z } from 'zod';
import OpenAI from 'openai';
import { conversationRepository } from '../repository/conversation.repository';
import type { ChatMessage } from '../repository/conversation.repository';
import type { ConversationSummary } from '../repository/conversation.repository';
import type { ConversationExportItem } from '../repository/conversation.repository';
import { firebaseAdminAuth } from '../lib/firebase-admin';
import {
   analyticsRepository,
   type AnalyticsSummary,
} from '../repository/analytics.repository';

const chatRequestSchema = z.object({
   prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(1000, 'Prompt is too long (max 1000 characters)'),
   conversationId: z.string().trim().optional(),
   projectId: z.string().trim().optional(),
   templateRun: z
      .object({
         templateId: z.string().trim().optional(),
         templateTitle: z.string().trim().optional(),
         templateVersion: z.number().int().positive().optional(),
      })
      .optional(),
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

   ensureConversation(conversationId: string | undefined) {
      if (conversationId && conversationId.trim() !== '') {
         return { conversationId };
      }

      return { conversationId: createConversationId() };
   }

   async chat(
      prompt: string,
      conversationId: string,
      uid: string,
      metadata?: {
         projectId?: string | null;
         templateRun?: {
            templateId?: string;
            templateTitle?: string;
            templateVersion?: number;
         };
      }
   ) {
      const startedAt = Date.now();
      const previousConversation = await conversationRepository.getConversation(
         uid,
         conversationId
      );
      const conversation: ChatMessage[] = [
         ...previousConversation,
         { role: 'user', content: prompt },
      ];

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
      const assistantMessage =
         message.trim() || "I couldn't generate a response this time.";

      await conversationRepository.appendTurn(
         uid,
         conversationId,
         prompt,
         assistantMessage,
         {
            projectId: metadata?.projectId ?? null,
            templateId: metadata?.templateRun?.templateId ?? null,
            templateTitle: metadata?.templateRun?.templateTitle ?? null,
            templateVersion: metadata?.templateRun?.templateVersion ?? null,
         }
      );

      const estimatedTokens = analyticsRepository.estimateFromPromptAndResponse(
         prompt,
         assistantMessage
      );
      await analyticsRepository.recordUsageEvent({
         uid: uid === 'anonymous' ? null : uid,
         authType: uid === 'anonymous' ? 'guest' : 'logged_in',
         conversationId,
         projectId: metadata?.projectId ?? null,
         templateId: metadata?.templateRun?.templateId ?? null,
         templateTitle: metadata?.templateRun?.templateTitle ?? null,
         templateVersion: metadata?.templateRun?.templateVersion ?? null,
         promptLength: prompt.length,
         responseLength: assistantMessage.length,
         estimatedInputTokens: estimatedTokens.estimatedInputTokens,
         estimatedOutputTokens: estimatedTokens.estimatedOutputTokens,
         estimatedTotalTokens: estimatedTokens.estimatedTotalTokens,
         responseTimeMs: Math.max(1, Date.now() - startedAt),
      });

      return { message: assistantMessage };
   }

   async *chatStream(
      prompt: string,
      conversationId: string,
      uid: string,
      metadata?: {
         projectId?: string | null;
         templateRun?: {
            templateId?: string;
            templateTitle?: string;
            templateVersion?: number;
         };
      }
   ) {
      const startedAt = Date.now();
      const previousConversation = await conversationRepository.getConversation(
         uid,
         conversationId
      );
      const conversation: ChatMessage[] = [
         ...previousConversation,
         { role: 'user', content: prompt },
      ];

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

      const assistantMessage =
         fullMessage.trim() || "I couldn't generate a response this time.";
      await conversationRepository.appendTurn(
         uid,
         conversationId,
         prompt,
         assistantMessage,
         {
            projectId: metadata?.projectId ?? null,
            templateId: metadata?.templateRun?.templateId ?? null,
            templateTitle: metadata?.templateRun?.templateTitle ?? null,
            templateVersion: metadata?.templateRun?.templateVersion ?? null,
         }
      );

      const estimatedTokens = analyticsRepository.estimateFromPromptAndResponse(
         prompt,
         assistantMessage
      );
      await analyticsRepository.recordUsageEvent({
         uid: uid === 'anonymous' ? null : uid,
         authType: uid === 'anonymous' ? 'guest' : 'logged_in',
         conversationId,
         projectId: metadata?.projectId ?? null,
         templateId: metadata?.templateRun?.templateId ?? null,
         templateTitle: metadata?.templateRun?.templateTitle ?? null,
         templateVersion: metadata?.templateRun?.templateVersion ?? null,
         promptLength: prompt.length,
         responseLength: assistantMessage.length,
         estimatedInputTokens: estimatedTokens.estimatedInputTokens,
         estimatedOutputTokens: estimatedTokens.estimatedOutputTokens,
         estimatedTotalTokens: estimatedTokens.estimatedTotalTokens,
         responseTimeMs: Math.max(1, Date.now() - startedAt),
      });
   }

   async listConversations(
      uid: string,
      projectId?: string
   ): Promise<ConversationSummary[]> {
      return conversationRepository.listConversations(uid, 40, projectId);
   }

   async exportConversations(uid: string): Promise<ConversationExportItem[]> {
      return conversationRepository.exportConversations(uid);
   }

   async deleteAllConversations(uid: string): Promise<number> {
      return conversationRepository.deleteAllConversations(uid);
   }

   async deleteAccount(uid: string): Promise<void> {
      await conversationRepository.deleteUserData(uid);
      await firebaseAdminAuth.deleteUser(uid);
   }

   async getAnalyticsSummary(windowDays = 30): Promise<AnalyticsSummary> {
      return analyticsRepository.buildSummary(windowDays);
   }

   async exportAnalyticsCsv(windowDays = 30): Promise<string> {
      return analyticsRepository.exportSummaryCsv(windowDays);
   }
}
