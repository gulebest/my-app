import type { Request, Response } from 'express';
import { ChatService } from '../service/chat.service';
import type { ConversationExportItem } from '../repository/conversation.repository';

const chatService = new ChatService();

function csvEscape(value: string) {
   const escaped = value.replace(/"/g, '""');
   return `"${escaped}"`;
}

function buildCsvExport(items: ConversationExportItem[]) {
   const rows: string[] = [
      [
         'conversationId',
         'title',
         'lastMessage',
         'conversationCreatedAt',
         'conversationUpdatedAt',
         'messageRole',
         'messageContent',
         'messageCreatedAt',
      ].join(','),
   ];

   for (const item of items) {
      if (item.messages.length === 0) {
         rows.push(
            [
               csvEscape(item.conversationId),
               csvEscape(item.title),
               csvEscape(item.lastMessage),
               csvEscape(item.createdAt || ''),
               csvEscape(item.updatedAt || ''),
               csvEscape(''),
               csvEscape(''),
               csvEscape(''),
            ].join(',')
         );
         continue;
      }

      for (const message of item.messages) {
         rows.push(
            [
               csvEscape(item.conversationId),
               csvEscape(item.title),
               csvEscape(item.lastMessage),
               csvEscape(item.createdAt || ''),
               csvEscape(item.updatedAt || ''),
               csvEscape(message.role),
               csvEscape(message.content),
               csvEscape(message.createdAt || ''),
            ].join(',')
         );
      }
   }

   return rows.join('\n');
}

export const chatHandler = async (req: Request, res: Response) => {
   // Validate request
   const parsed = chatService.validateRequest(req.body);
   if (!parsed.success) {
      return res.status(400).json({
         error: 'Invalid request body',
         details: parsed.error.flatten().fieldErrors,
      });
   }

   const { prompt, conversationId, projectId, templateRun } = parsed.data;
   const uid = req.authUser?.uid ?? 'anonymous';

   const { conversationId: resolvedId } =
      chatService.ensureConversation(conversationId);

   try {
      const { message } = await chatService.chat(prompt, resolvedId, uid, {
         projectId: projectId || null,
         templateRun,
      });
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

   const { prompt, conversationId, projectId, templateRun } = parsed.data;
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
         uid,
         {
            projectId: projectId || null,
            templateRun,
         }
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
      const projectId =
         typeof req.query.projectId === 'string'
            ? req.query.projectId
            : undefined;
      const conversations = await chatService.listConversations(uid, projectId);
      return res.json({ conversations });
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to load conversations',
         details: err instanceof Error ? err.message : err,
      });
   }
};

export const exportConversationsHandler = async (
   req: Request,
   res: Response
) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   const format =
      typeof req.query.format === 'string'
         ? req.query.format.toLowerCase()
         : 'json';

   try {
      const conversations = await chatService.exportConversations(uid);
      if (format === 'csv') {
         const csv = buildCsvExport(conversations);
         res.setHeader('Content-Type', 'text/csv; charset=utf-8');
         res.setHeader(
            'Content-Disposition',
            `attachment; filename="assistly-conversations-${uid}.csv"`
         );
         return res.send(csv);
      }

      return res.json({ conversations });
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to export conversations',
         details: err instanceof Error ? err.message : err,
      });
   }
};

export const deleteConversationsHandler = async (
   req: Request,
   res: Response
) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   try {
      const deletedCount = await chatService.deleteAllConversations(uid);
      return res.json({ success: true, deletedCount });
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to delete conversations',
         details: err instanceof Error ? err.message : err,
      });
   }
};

export const deleteAccountHandler = async (req: Request, res: Response) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   try {
      await chatService.deleteAccount(uid);
      return res.json({ success: true });
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to delete account',
         details: err instanceof Error ? err.message : err,
      });
   }
};

export const analyticsSummaryHandler = async (req: Request, res: Response) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   const requestedWindow = Number(req.query.windowDays || 30);
   const windowDays = Number.isFinite(requestedWindow)
      ? Math.max(7, Math.min(365, Math.round(requestedWindow)))
      : 30;

   try {
      const summary = await chatService.getAnalyticsSummary(windowDays);
      return res.json(summary);
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to load analytics',
         details: err instanceof Error ? err.message : err,
      });
   }
};

export const exportAnalyticsHandler = async (req: Request, res: Response) => {
   const uid = req.authUser?.uid;
   if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   const requestedWindow = Number(req.query.windowDays || 30);
   const windowDays = Number.isFinite(requestedWindow)
      ? Math.max(7, Math.min(365, Math.round(requestedWindow)))
      : 30;

   try {
      const csv = await chatService.exportAnalyticsCsv(windowDays);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
         'Content-Disposition',
         `attachment; filename="assistly-analytics-${windowDays}d.csv"`
      );
      return res.send(csv);
   } catch (err) {
      return res.status(500).json({
         error: 'Failed to export analytics',
         details: err instanceof Error ? err.message : err,
      });
   }
};
