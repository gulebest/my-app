import type { Request, Response } from 'express';
import { ChatService } from '../service/chat.service';

const chatService = new ChatService();

export const chatHandler = async (req: Request, res: Response) => {
   // Validate request
   const parsed = chatService.validateRequest(req.body);
   if (!parsed.success) {
      return res.status(400).json({
         error: 'Invalid request body',
         details: parsed.error.flatten().fieldErrors,
      });
   }

   const { prompt, conversationId, userId } = parsed.data;

   // Conversation existence/creation logic
   const convoResult = chatService.ensureConversation(conversationId, userId);
   if ('error' in convoResult) {
      return res.status(404).json({ error: convoResult.error });
   }
   const { key, conversationId: resolvedId } = convoResult;

   try {
      const { message } = await chatService.chat(
         prompt,
         resolvedId,
         userId ?? 'anonymous'
      );
      res.json({ message, conversationId: resolvedId });
   } catch (err: any) {
      if (err?.type === 'ai') {
         return res.status(502).json({
            error: 'AI model error',
            details: err.error instanceof Error ? err.error.message : err.error,
         });
      }
      res.status(500).json({
         error: 'Server error',
         details: err instanceof Error ? err.message : err,
      });
   }
};
