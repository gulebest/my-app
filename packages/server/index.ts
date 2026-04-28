import type { Request, Response } from 'express';
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import zod from 'zod';

dotenv.config();

const client = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY,
   baseURL: 'https://openrouter.ai/api/v1', // ✅ REQUIRED for OpenRouter
   defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000', // optional but recommended
      'X-Title': 'My App',
   },
});

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
   res.send('Hello, World!');
});

app.get('/api/hello', (req, res) => {
   res.send({
      message: 'Hello, World! this is from the server through api endpoint',
   });
});

type ChatMessage = {
   role: 'system' | 'user' | 'assistant';
   content: string;
};

const conversations = new Map<string, ChatMessage[]>();

const chatRequestSchema = zod.object({
   prompt: zod
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(1000, 'Prompt is too long (max 1000 characters)'),
   conversationId: zod.string().trim().optional(),
   userId: zod.string().trim().optional(),
});

const createConversationId = () => {
   if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
   ) {
      return crypto.randomUUID();
   }

   return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

app.post('/api/chat', async (req: Request, res: Response) => {
   try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json({
            error: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
         });
      }

      const { prompt, conversationId, userId } = parsed.data;
      const hasConversationId = !!(conversationId && conversationId.length > 0);
      const convoId = hasConversationId
         ? conversationId
         : createConversationId();
      const userKey = userId && userId.length > 0 ? userId : 'anonymous';
      const key = `${userKey}:${convoId}`;

      if (
         hasConversationId &&
         conversationId.trim() !== '' &&
         !conversations.has(key)
      ) {
         return res.status(404).json({ error: 'Conversation not found' });
      }

      const conversation = conversations.get(key) ?? [];
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
         console.error('AI model error:', aiError);
         return res.status(502).json({
            error: 'AI model error',
            details: aiError instanceof Error ? aiError.message : aiError,
         });
      }

      const message = response.choices?.[0]?.message?.content ?? '';
      if (message) {
         conversation.push({ role: 'assistant', content: message });
      }
      conversations.set(key, conversation);
      res.json({ message, conversationId: convoId });
   } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({
         error: 'Server error',
         details: error instanceof Error ? error.message : error,
      });
   }
});

app.listen(port, () => {
   console.log(`Server running on http://localhost:${port}`);
});
