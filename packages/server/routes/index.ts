import { Router } from 'express';
import type { Request } from 'express';
import type { Response } from 'express';
import { chatHandler, chatStreamHandler } from '../controller/chat.controller';

const router = Router();

router.get('/', (req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (req: Request, res: Response) => {
   res.json({ message: 'Hello World!' });
});

router.post('/api/chat', chatHandler);
router.post('/api/chat/stream', chatStreamHandler);

export default router;
