import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditRouter } from './routes/audit.js';
import { crawlRouter } from './routes/crawl.js';
import { gscRouter } from './routes/gsc.js';
import { gaRouter } from './routes/ga.js';
import { seoptimerRouter } from './routes/seoptimer.js';
import { sheetsRouter } from './routes/sheets.js';
import { keywordRouter } from './routes/keywords.js';
import { ahrefsRouter } from './routes/ahrefs.js';
import { authRouter, authMiddleware } from './auth/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Health check - public
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes - public (login, verify, logout)
app.use('/api/auth', authRouter);

// Protect all other API routes
app.use('/api', authMiddleware);

app.use('/api', auditRouter);
app.use('/api/crawl', crawlRouter);
app.use('/api/gsc', gscRouter);
app.use('/api/ga', gaRouter);
app.use('/api/seoptimer', seoptimerRouter);
app.use('/api/sheets', sheetsRouter);
app.use('/api/keywords', keywordRouter);
app.use('/api/ahrefs', ahrefsRouter);

if (isProduction) {
  const clientPath = path.join(__dirname, 'public');
  app.use(express.static(clientPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
