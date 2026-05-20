import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import troupesRouter from './routes/troupes';
import eventsRouter from './routes/events';
import feedRouter from './routes/feed';
import { invitesRouter, redeemRouter } from './routes/invites';

const app = express();
const PORT = process.env.PORT ?? 8080;

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/troupes', troupesRouter);
app.use('/api/troupes', eventsRouter);
app.use('/api/troupes', invitesRouter);
app.use('/api/invites', redeemRouter);
app.use('/api/events', feedRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
