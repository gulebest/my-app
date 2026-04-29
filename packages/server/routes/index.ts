import { Router } from 'express';
import type { Request } from 'express';
import type { Response } from 'express';
import { chatHandler, chatStreamHandler } from '../controller/chat.controller';
import { optionalFirebaseAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', (req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (req: Request, res: Response) => {
   res.json({ message: 'Hello World!' });
});

router.post('/api/chat', optionalFirebaseAuth, chatHandler);
router.post('/api/chat/stream', optionalFirebaseAuth, chatStreamHandler);

export default router;
