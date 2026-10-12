import fs from 'fs';
import path from 'path';
import { ServerResponse } from 'http';
import express, { Express, NextFunction, Request, Response } from 'express';
import { ADMIN_BASE_PATH } from './config/admin-slug';

function findDist(workspace: 'client-admin' | 'client-store'): string {
  const override = process.env[workspace === 'client-admin' ? 'ADMIN_DIST_DIR' : 'STORE_DIST_DIR'];
  if (override) return path.resolve(override);

  const starts = [typeof __dirname !== 'undefined' ? __dirname : process.cwd(), process.cwd()];
  for (const start of starts) {
    let dir = path.resolve(start);
    for (let i = 0; i < 6; i += 1) {
      const candidate = path.join(dir, workspace, 'dist');
      if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return path.resolve(process.cwd(), workspace, 'dist');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Looks like Express's own 404 page, but the echoed text is HTML-escaped. */
function sendFake404(req: Request, res: Response): void {
  let pathname = '/admin';
  try {
    pathname = new URL(req.originalUrl, 'http://localhost').pathname;
  } catch {
    pathname = '/admin';
  }
  const body =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n' +
    `<pre>Cannot ${escapeHtml(req.method)} ${escapeHtml(pathname)}</pre>\n</body>\n</html>\n`;
  res.status(404);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.send(body);
}

function setNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function setMediaHeaders(res: ServerResponse, filePath: string): void {
  if (filePath.endsWith('.webm')) res.setHeader('Content-Type', 'video/webm');
}

function isGetOrHead(req: Request): boolean {
  return req.method === 'GET' || req.method === 'HEAD';
}

/**
 * Call AFTER every real /api router AND both bot webhooks are mounted.
 * Remove every older static / wildcard / '/admin' handler from production.ts and server.ts.
 */
export function registerStaticRoutes(app: Express): void {
  app.set('trust proxy', 1);

  const adminDist = findDist('client-admin');
  const storeDist = findDist('client-store');
  const adminIndex = path.join(adminDist, 'index.html');
  const storeIndex = path.join(storeDist, 'index.html');

  console.log(
    `[static] admin=${adminDist} (index.html: ${fs.existsSync(adminIndex)}) ` +
      `store=${storeDist} (index.html: ${fs.existsSync(storeIndex)})`,
  );

  // 1. Unknown /api paths -> JSON 404
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });

  // 2. STEALTH TRAP: /admin and /admin/* always look like a genuine Express 404
  app.use('/admin', (req: Request, res: Response) => {
    sendFake404(req, res);
  });

  // 3. Admin Mini App, served ONLY on the secret slug
  app.use(
    `${ADMIN_BASE_PATH}/assets`,
    express.static(path.join(adminDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
      setHeaders: setMediaHeaders,
    }),
  );
  app.use(
    ADMIN_BASE_PATH,
    express.static(adminDist, { index: false, maxAge: '1h', setHeaders: setMediaHeaders }),
  );
  app.use(ADMIN_BASE_PATH, (req: Request, res: Response, next: NextFunction) => {
    if (!isGetOrHead(req)) return next();
    if (path.extname(req.path)) {
      res.status(404).end();
      return undefined;
    }
    if (!fs.existsSync(adminIndex)) {
      res.status(404).type('text/plain').send('Admin bundle missing');
      return undefined;
    }
    setNoStore(res);
    res.sendFile(adminIndex);
    return undefined;
  });

  // 4. Store: hashed assets immutable, other static files 7 days (emojis), SPA fallback never touches /api, /admin or the slug
  app.use(
    '/assets',
    express.static(path.join(storeDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
      setHeaders: setMediaHeaders,
    }),
  );
  app.use(express.static(storeDist, { index: false, maxAge: '7d', setHeaders: setMediaHeaders }));

  const slugLower = ADMIN_BASE_PATH.toLowerCase();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isGetOrHead(req)) return next();
    const p = req.path.toLowerCase();
    if (
      p === '/api' || p.startsWith('/api/') ||
      p === '/admin' || p.startsWith('/admin/') ||
      p === slugLower || p.startsWith(`${slugLower}/`)
    ) {
      return next();
    }
    if (path.extname(req.path)) {
      res.status(404).end();
      return undefined;
    }
    if (!fs.existsSync(storeIndex)) {
      res.status(404).type('text/plain').send('Store bundle missing');
      return undefined;
    }
    setNoStore(res);
    res.sendFile(storeIndex);
    return undefined;
  });
}
