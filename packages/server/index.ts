import type { Request, Response } from 'express';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
   res.send('Hello, World!');
});
app.get('/api/hello', (req, res) => {
   res.send({
      message: 'Hello, World! this is from the server through api endpoint',
   });
});

app.listen(port, () => {
   console.log(`Server running on http://localhost:${port}`);
});
