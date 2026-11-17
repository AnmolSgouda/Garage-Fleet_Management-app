import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fleetRouter } from './routes/fleetRoutes.js';

export function createApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(
    cors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));

  // Mount REST API before static serving
  app.use('/api', fleetRouter);

  // Serve Angular production build & public vehicle assets
  const rootDir = process.cwd();
  const angularDistCandidates = [
    path.join(rootDir, 'frontend', 'dist', 'fleet-app', 'browser'),
    path.join(rootDir, '..', 'frontend', 'dist', 'fleet-app', 'browser'),
  ];
  const publicDir = path.join(rootDir, 'public');

  const distDir = angularDistCandidates.find((candidate) => fs.existsSync(candidate));
  if (distDir) {
    app.use(express.static(distDir, { index: false }));
  }
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { index: false }));
  }

  // SPA fallback for Angular client routing (excluding /api)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    res.status(200).send('<!doctype html><html><body><p>Fleet Service Planning API is running. Build frontend to serve UI.</p></body></html>');
  });

  return app;
}
