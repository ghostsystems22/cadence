import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { z } from 'zod';
import { recordToAirtable, recordToClient, tables, toAirtable } from './mapping.mjs';

const port = Number(process.env.PORT || 8080);
const baseId = process.env.AIRTABLE_BASE_ID;
const pat = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const dist = join(process.cwd(), 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const writeSchema = z.object({ fields: z.record(z.string(), z.unknown()).optional(), records: z.array(z.object({ id: z.string().optional(), fields: z.record(z.string(), z.unknown()) })).max(10).optional(), performUpsert: z.object({ fieldsToMergeOn: z.array(z.string()).min(1) }).optional() });
let bootstrapCache;

class AirtableError extends Error { constructor(status, message) { super(message); this.status = status; } }
class AirtableQueue {
  constructor() { this.pending = []; this.active = 0; this.lastStart = 0; this.timer = null; }
  run(work) { return new Promise((resolve, reject) => { this.pending.push({ work, resolve, reject }); this.drain(); }); }
  drain() {
    if (this.active >= 3 || !this.pending.length || this.timer) return;
    const wait = Math.max(0, 200 - (Date.now() - this.lastStart));
    this.timer = setTimeout(async () => {
      this.timer = null;
      const next = this.pending.shift(); if (!next) return;
      this.active += 1; this.lastStart = Date.now();
      try { next.resolve(await next.work()); } catch (error) { next.reject(error); } finally { this.active -= 1; this.drain(); }
      this.drain();
    }, wait);
  }
}
const queue = new AirtableQueue();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); };
const airtable = async (path, init = {}) => queue.run(async () => {
  if (!baseId || !pat) throw new AirtableError(500, 'Airtable credentials missing');
  let lastError;
  for (const delay of [0, 250, 500, 1000, 2000, 4000]) {
    if (delay) await pause(delay);
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${path}`, { ...init, headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body;
    if (response.status !== 429) throw new AirtableError(response.status, body?.error?.message || body?.error?.type || `Airtable ${response.status}`);
    lastError = new AirtableError(429, 'Airtable rate limit exceeded');
  }
  throw lastError;
});
const listAll = async (table, query = '') => {
  const records = []; let offset;
  do {
    const params = new URLSearchParams(query);
    params.set('pageSize', '100'); if (offset) params.set('offset', offset);
    const page = await airtable(`${encodeURIComponent(table)}?${params}`);
    records.push(...(page.records || [])); offset = page.offset;
  } while (offset);
  return records;
};
const writeRecords = async (table, body) => {
  const records = body.records ?? (body.fields ? [{ fields: body.fields }] : []);
  if (!records.length) throw new AirtableError(400, 'fields or records required');
  if (records.length > 10) throw new AirtableError(400, 'Airtable batches are limited to 10 records');
  const payload = { records: records.map((record) => recordToAirtable(table, record)) };
  if (body.performUpsert) payload.performUpsert = { fieldsToMergeOn: body.performUpsert.fieldsToMergeOn.map((field) => toAirtable(table, { [field]: null }) && field === 'key' ? 'Key' : field) };
  const result = await airtable(encodeURIComponent(table), { method: 'PATCH', body: JSON.stringify(payload) });
  bootstrapCache = undefined;
  return (result.records || []).map((record) => recordToClient(table, record));
};
const ensureDefaults = async () => {
  const template = await listAll('Capacity Template');
  if (!template.length) {
    const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const records = weekdays.map((weekday, index) => ({ fields: { Weekday: String(index), Index: index, Hours: index === 0 || index === 6 ? 0 : 8 } }));
    await airtable(encodeURIComponent('Capacity Template'), { method: 'POST', body: JSON.stringify({ records }) });
  }
  const existing = await listAll('Settings');
  const keys = new Set(existing.map((record) => record.fields.Key));
  const defaults = [['default_day_hours', '8'], ['default_task_hours', '1'], ['spill_horizon_days', '90']]
    .filter(([key]) => !keys.has(key)).map(([key, value]) => ({ fields: { Key: key, Value: value } }));
  if (defaults.length) await airtable(encodeURIComponent('Settings'), { method: 'POST', body: JSON.stringify({ records: defaults }) });
};
const bootstrap = async () => {
  if (bootstrapCache && Date.now() - bootstrapCache.at < 20_000) return bootstrapCache.data;
  await ensureDefaults();
  const raw = await Promise.all(['Projects', 'Phases', 'Tasks', 'Milestones', 'Day Capacity', 'Capacity Template', 'Settings'].map(async (table) => [table, await listAll(table)]));
  const result = Object.fromEntries(raw.map(([table, records]) => [table, records.map((record) => recordToClient(table, record))]));
  const now = new Date();
  const before = new Date(now); before.setUTCDate(before.getUTCDate() - 180);
  const after = new Date(now); after.setUTCDate(after.getUTCDate() + 180);
  result['Day Capacity'] = result['Day Capacity'].filter((record) => !record.fields.day || (record.fields.day >= before.toISOString().slice(0, 10) && record.fields.day <= after.toISOString().slice(0, 10)));
  bootstrapCache = { at: Date.now(), data: result };
  return result;
};
const addDays = (date, days) => { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return { before: copy.toISOString().slice(0, 10), after: (() => { const after = new Date(date); after.setUTCDate(after.getUTCDate() + Math.abs(days)); return after.toISOString().slice(0, 10); })() }; };
const allowedQuery = (url) => {
  const params = new URLSearchParams();
  for (const key of ['offset', 'filterByFormula', 'pageSize']) if (url.searchParams.has(key)) params.set(key, url.searchParams.get(key));
  return params.toString();
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (url.pathname === '/api/health') return json(response, 200, { ok: true, source: baseId ? 'airtable' : 'unconfigured', at: new Date().toISOString() });
    if (url.pathname === '/api/bootstrap' && request.method === 'GET') return json(response, 200, await bootstrap());
    if (parts[0] === 'api' && tables.includes(parts[1])) {
      const table = parts[1];
      if (request.method === 'GET') {
        const page = await airtable(`${encodeURIComponent(table)}?${allowedQuery(url)}`);
        return json(response, 200, { records: (page.records || []).map((record) => recordToClient(table, record)), offset: page.offset });
      }
      if (request.method === 'POST' || request.method === 'PATCH') {
        const body = writeSchema.parse(await readBody(request));
        if (request.method === 'PATCH' && parts[2]) {
          const fields = toAirtable(table, body.fields || {});
          const result = await airtable(`${encodeURIComponent(table)}/${encodeURIComponent(parts[2])}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
          bootstrapCache = undefined; return json(response, 200, recordToClient(table, result));
        }
        const records = request.method === 'POST'
          ? await (() => { const value = body.records ?? (body.fields ? [{ fields: body.fields }] : []); if (!value.length || value.length > 10) throw new AirtableError(400, 'Airtable batches are limited to 10 records'); return airtable(encodeURIComponent(table), { method: 'POST', body: JSON.stringify({ records: value.map((record) => recordToAirtable(table, record)) }) }).then((result) => result.records.map((record) => recordToClient(table, record))); })()
          : await writeRecords(table, body);
        bootstrapCache = undefined; return json(response, request.method === 'POST' ? 201 : 200, { records });
      }
      if (request.method === 'DELETE' && parts[2]) { await airtable(`${encodeURIComponent(table)}/${encodeURIComponent(parts[2])}`, { method: 'DELETE' }); bootstrapCache = undefined; return json(response, 200, { id: parts[2], deleted: true }); }
    }
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Unknown API route' });
    const requested = url.pathname === '/' ? 'index.html' : normalize(url.pathname).replace(/^\/+/, '');
    const file = join(dist, requested); const target = existsSync(file) && !file.includes('..') ? file : join(dist, 'index.html');
    const info = await stat(target); if (!info.isFile()) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream', 'Cache-Control': target.endsWith('index.html') || target === join(dist, 'sw.js') ? 'no-cache' : 'public, max-age=604800' }); createReadStream(target).pipe(response);
  } catch (error) { console.error(error); json(response, error instanceof AirtableError ? error.status : 500, { error: error instanceof Error ? error.message : 'Server error' }); }
});
async function readBody(request) { let raw = ''; for await (const chunk of request) raw += chunk; return raw ? JSON.parse(raw) : {}; }
server.listen(port, '0.0.0.0', () => console.log(`Cadence listening on ${port}`));
