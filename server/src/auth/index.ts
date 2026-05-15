import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.APP_PASSWORD || 'changeme';
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function packToken(password: string): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${password}:${expiry}`;
  const sig = hmac(payload);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function unpackToken(token: string): { valid: boolean; reason?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length < 3) return { valid: false, reason: 'Malformed token' };
    const expiry = parseInt(parts[parts.length - 2], 10);
    const sig = parts[parts.length - 1];
    const payload = `${parts.slice(0, -2).join(':')}:${expiry}`;
    const expected = hmac(payload);
    if (sig !== expected) return { valid: false, reason: 'Invalid signature' };
    if (Date.now() > expiry) return { valid: false, reason: 'Token expired' };
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid token format' };
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const result = unpackToken(authHeader.slice(7));
  if (!result.valid) {
    res.status(401).json({ error: 'Unauthorized', reason: result.reason });
    return;
  }
  next();
}

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Password required' });
    return;
  }
  if (password !== getSecret()) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const token = packToken(password);
  res.json({ token, expiresIn: TOKEN_EXPIRY_MS });
});

authRouter.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.json({ valid: false });
    return;
  }
  const result = unpackToken(authHeader.slice(7));
  res.json({ valid: result.valid, reason: result.reason });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});
