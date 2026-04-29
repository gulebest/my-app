import { Router } from 'express';
import type { Request } from 'express';
import type { Response } from 'express';
import {
   chatHandler,
   chatStreamHandler,
   listConversationsHandler,
} from '../controller/chat.controller';
import {
   optionalFirebaseAuth,
   requireFirebaseAuth,
} from '../middleware/auth.middleware';

const router = Router();

router.get('/', (req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (req: Request, res: Response) => {
   res.json({ message: 'Hello World!' });
});

router.post('/api/chat', optionalFirebaseAuth, chatHandler);
router.post('/api/chat/stream', optionalFirebaseAuth, chatStreamHandler);
router.get('/api/conversations', requireFirebaseAuth, listConversationsHandler);

export default router;
