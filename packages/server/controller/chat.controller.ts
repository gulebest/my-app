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

   const { prompt, conversationId } = parsed.data;
   const uid = req.authUser?.uid ?? 'anonymous';

   const { conversationId: resolvedId } =
      chatService.ensureConversation(conversationId);

   try {
      const { message } = await chatService.chat(prompt, resolvedId, uid);
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

export const chatStreamHandler = async (req: Request, res: Response) => {
   const parsed = chatService.validateRequest(req.body);
   if (!parsed.success) {
      return res.status(400).json({
         error: 'Invalid request body',
         details: parsed.error.flatten().fieldErrors,
      });
   }

   const { prompt, conversationId } = parsed.data;
   const uid = req.authUser?.uid ?? 'anonymous';
   const { conversationId: resolvedId } =
      chatService.ensureConversation(conversationId);

   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   res.flushHeaders?.();

   let isClientClosed = false;
   req.on('close', () => {
      isClientClosed = true;
   });

   const writeEvent = (payload: unknown) => {
      if (!isClientClosed) {
         res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
   };

   writeEvent({ type: 'conversation', conversationId: resolvedId });

   try {
      let fullMessage = '';
      for await (const delta of chatService.chatStream(
         prompt,
         resolvedId,
         uid
      )) {
         if (isClientClosed) {
            break;
         }
         fullMessage += delta;
         writeEvent({ type: 'delta', delta });
      }

      writeEvent({
         type: 'done',
         message: fullMessage,
         conversationId: resolvedId,
      });
      if (!isClientClosed) {
         res.end();
      }
   } catch (err: any) {
      const errorMessage =
         err?.type === 'ai'
            ? err?.error instanceof Error
               ? err.error.message
               : 'AI model error'
            : err instanceof Error
              ? err.message
              : 'Server error';

      writeEvent({
         type: 'error',
         error: errorMessage,
      });
      if (!isClientClosed) {
         res.end();
      }
   }
};

export const listConversationsHandler = async (req: Request, res: Response) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   try {
      const conversations = await chatService.listConversations(uid);
      return res.json({ conversations });
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to load conversations',
         details: err instanceof Error ? err.message : err,
      });
   }
};
