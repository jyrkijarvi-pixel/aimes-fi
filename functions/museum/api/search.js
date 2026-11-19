import { normalize, topics } from '../../../museum/smithsonian.js';

const memory = new Map(), inFlight = new Map(), visitors = new Map();
const TTL = 900000, SIZE = 12, MAX_START = 240;
let cooldownUntil = 0;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const reply = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Cache-Control': 'no-store', ...extra } });
export function parseSearch(url) {
  const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const topic = url.searchParams.get('topic') || '';
  const rawStart = url.searchParams.get('start') || '0';
  if (q.length > 100 || (q && q.length < 2) || /[\u0000-\u001f]/.test(q) || (topic && !Object.hasOwn(topics, topic)) || !/^\d{1,3}$/.test(rawStart)) return null;
  const start = Number(rawStart);
  if (start > MAX_START || start % SIZE) return null;
  // Treat user input as words, not an unrestricted Lucene expression.
  const literal = q.split(' ').filter(Boolean).map(word => '"' + word.replace(/[\\"]/g, '\\$&') + '"').join(' AND ');
  const query = literal && topics[topic] ? '(' + literal + ') AND ' + topics[topic] : literal || topics[topic] || '*:*';
  const filters = topic === 'models' ? ['online_media_type:"3D Models"'] : topic === 'maps' ? ['online_media_type:Images', 'object_type:Maps'] : ['(online_media_type:Images OR online_media_type:"3D Models")'];
  return { q, topic, start, query, filters, guided: !q && !topic };
}
export async function onRequest(ctx) {
  if (ctx.request.method !== 'GET') return reply({ error: 'method' }, 405, { Allow: 'GET' });
  const origin = ctx.request.headers.get('Origin');
  if (ctx.request.headers.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== new URL(ctx.request.url).origin)) return reply({ error: 'origin' }, 403);
  const parsed = parseSearch(new URL(ctx.request.url));
  if (!parsed) return reply({ error: 'invalid' }, 400);
  if (parsed.guided) return reply({ rows: [], total: 0, guided: true, upstreamRequests: 0 });
  if (!ctx.env.SMITHSONIAN_API_KEY) return reply({ error: 'configuration' }, 503);
  const identity = JSON.stringify([parsed.q.toLowerCase(), parsed.topic, parsed.start]);
  const cacheRequest = new Request(new URL('/museum/api/cache?v=1&key=' + encodeURIComponent(identity), ctx.request.url));
  const edge = globalThis.caches?.default;
  const prior = memory.get(identity);
  if (prior && prior.until > Date.now()) return reply({ ...prior.data, cached: true, upstreamRequests: 0 });
  try {
    const hit = await edge?.match(cacheRequest);
    if (hit) return reply({ ...await hit.json(), cached: true, upstreamRequests: 0 });
  } catch { /* A cache outage must not disable the module. */ }
  const retry = Math.ceil((cooldownUntil - Date.now()) / 1000);
  if (retry > 0) return reply({ error: 'limit', retryAfter: retry }, 429, { 'Retry-After': String(retry) });
  if (inFlight.has(identity)) {
    try { return reply({ ...await inFlight.get(identity), cached: true, upstreamRequests: 0 }); }
    catch { return reply({ error: 'unavailable' }, 503); }
  }
  const ip = ctx.request.headers.get('CF-Connecting-IP') || 'local';
  const visitor = visitors.get(ip);
  if (visitor && visitor.until > Date.now() && visitor.count >= 20) return reply({ error: 'limit', retryAfter: 60 }, 429, { 'Retry-After': '60' });
  visitors.set(ip, { count: visitor && visitor.until > Date.now() ? visitor.count + 1 : 1, until: visitor && visitor.until > Date.now() ? visitor.until : Date.now() + 60000 });
  if (visitors.size > 256) visitors.delete(visitors.keys().next().value);
  const load = async () => {
    const url = new URL('https://api.si.edu/openaccess/api/v1.0/search');
    for (const [key, value] of Object.entries({ q: parsed.query, type: 'edanmdm', rows: String(SIZE), start: String(parsed.start), fqs: JSON.stringify(parsed.filters) })) url.searchParams.set(key, value);
    const started = Date.now();
    const response = await fetch(url, { headers: { 'X-Api-Key': ctx.env.SMITHSONIAN_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = /^\d+$/.test(header || '') ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
      cooldownUntil = Date.now() + Math.max(60, Number.isFinite(seconds) ? seconds : 60) * 1000;
      throw new Error('limit');
    }
    if (!response.ok) throw new Error('unavailable');
    const payload = await response.json();
    if (payload.status && payload.status !== 200 && payload.status !== '200') throw new Error('unavailable');
    if (!Array.isArray(payload.response?.rows)) throw new Error('unavailable');
    const rows = [...new Map(payload.response.rows.map(normalize).map(row => [row.id, row])).values()];
    const total = Number(payload.response.rowCount) || 0;
    const next = parsed.start + SIZE;
    const data = { rows, total, start: parsed.start, next: next < total && next <= MAX_START ? next : null, bounded: next > MAX_START && next < total, cached: false, upstreamRequests: 1, ms: Date.now() - started };
    memory.set(identity, { data, until: Date.now() + TTL });
    if (memory.size > 128) memory.delete(memory.keys().next().value);
    if (edge) {
      const save = edge.put(cacheRequest, new Response(JSON.stringify(data), { headers: { ...headers, 'Cache-Control': 'public, max-age=900' } })).catch(() => {});
      ctx.waitUntil?.(save);
    }
    return data;
  };
  const promise = load(); inFlight.set(identity, promise);
  try { return reply(await promise); }
  catch (e) {
    if (e.message === 'limit') {
      const seconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
      return reply({ error: 'limit', retryAfter: seconds }, 429, { 'Retry-After': String(seconds) });
    }
    return reply({ error: 'unavailable' }, 503);
  } finally { inFlight.delete(identity); }
}
