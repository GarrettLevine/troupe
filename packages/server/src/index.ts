import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import authRouter from './routes/auth';
import meRouter from './routes/me';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
