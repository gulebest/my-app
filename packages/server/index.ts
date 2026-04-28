import express from 'express';
import dotenv from 'dotenv';
import router from './routes';

dotenv.config();

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

app.use('/', router);

app.listen(port, () => {
   console.log(`Server running on http://localhost:${port}`);
});
