// Runs the site on your own computer: `npm run dev`, then open http://localhost:3000
//
// It serves the /public folder and runs the /api files the same way Vercel
// does. Without Supabase settings it uses practice mode (passcode: "practice",
// data saved in .data/periods.json). To use your real database instead, put
// SUPABASE_URL, SUPABASE_SECRET_KEY and APP_PASSCODE in a file named .env.local

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.dirname(new URL(import.meta.url).pathname);
const port = Number(process.env.PORT) || 3000;

if (existsSync(path.join(root, '.env.local'))) {
  for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

// Apply the same security headers vercel.json sets online.
const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const extraHeaders = (vercelConfig.headers || []).flatMap((rule) => rule.headers);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, '');
  const file = path.join(root, 'api', `${name}.js`);
  if (!/^[a-z-]+$/.test(name) || !existsSync(file)) return send(res, 404, 'Not found');
  const handlers = await import(pathToFileURL(file).href);
  const handler = handlers[req.method];
  if (typeof handler !== 'function') return send(res, 405, 'Method not allowed');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
  const request = new Request(url, { method: req.method, headers: req.headers, body });
  const response = await handler(request);

  const headers = Object.fromEntries(response.headers);
  delete headers['set-cookie'];
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function handleStatic(res, url) {
  let file = path.join(root, 'public', path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(path.join(root, 'public'))) return send(res, 404, 'Not found');
  if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
  const data = await readFile(file).catch(() => null);
  if (!data) return send(res, 404, 'Not found');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(data);
}

function send(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(text);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  for (const { key, value } of extraHeaders) res.setHeader(key, value);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await handleStatic(res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Server error');
  }
}).listen(port, () => {
  const mode = process.env.SUPABASE_URL ? 'your Supabase database' : 'practice mode (passcode: "practice")';
  console.log(`Period Tracker running at http://localhost:${port} using ${mode}`);
});
