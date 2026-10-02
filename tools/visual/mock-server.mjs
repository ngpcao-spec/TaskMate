// Faux backend Supabase minimal (PostgREST + RPC + auth/user) pour les captures. Données en mémoire : fixtures.mjs
import http from 'node:http';
import { build, ids } from './fixtures.mjs';

const data = build();
const cmp = (a, b) => (typeof a === 'number' || /^-?\d+(\.\d+)?$/.test(String(a)) && /^-?\d+(\.\d+)?$/.test(String(b)) ? Number(a) - Number(b) : String(a).localeCompare(String(b)));

function matches(row, key, expr) {
  const v = row[key];
  const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/.exec(expr);
  if (!m) return true;
  const [, neg, op, raw] = m;
  let ok;
  if (op === 'is') ok = raw === 'null' ? v === null || v === undefined : String(v) === raw;
  else if (op === 'in') ok = raw.replace(/^\(|\)$/g, '').split(',').includes(String(v));
  else if (op === 'eq') ok = String(v) === raw;
  else if (op === 'neq') ok = String(v) !== raw;
  else if (v === null || v === undefined) ok = false;
  else ok = op === 'gt' ? cmp(v, raw) > 0 : op === 'gte' ? cmp(v, raw) >= 0 : op === 'lt' ? cmp(v, raw) < 0 : cmp(v, raw) <= 0;
  return neg ? !ok : ok;
}

function query(table, params) {
  let rows = [...(data[table] ?? [])];
  for (const [k, v] of params) if (!['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) rows = rows.filter((r) => matches(r, k, v));
  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map((o) => { const [c, dir = 'asc'] = o.split('.'); return { c, desc: dir === 'desc' }; });
    rows.sort((a, b) => { for (const { c, desc } of keys) { const x = a[c], y = b[c]; if (x === y) continue; if (x == null) return 1; if (y == null) return -1; const r = cmp(x, y); if (r) return desc ? -r : r; } return 0; });
  }
  const limit = params.get('limit');
  return limit ? rows.slice(0, Number(limit)) : rows;
}

function rpc(name, body) {
  const now = new Date().toISOString();
  const t = data.tasks.find((x) => x.id === (body.p_task_id ?? ''));
  if (name === 'complete_task' && t && !t.completed_at) { t.completed_at = now; }
  if (name === 'validate_task' && t) { t.validated_at = now; }
  if (name === 'uncomplete_task' && t) { t.completed_at = null; t.validated_at = null; }
  return null;
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, obj, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors, ...extra }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname.startsWith('/auth/v1/user')) return send(200, { id: ids.parent, aud: 'authenticated', role: 'authenticated', email: 'parent@taskmate.test' });
    if (url.pathname.startsWith('/auth/v1/')) return send(200, {});
    if (parts[0] === 'rest' && parts[2] === 'rpc') return send(200, rpc(parts[3], body ? JSON.parse(body) : {}));
    if (parts[0] === 'rest') {
      const table = parts[2];
      if (req.method === 'GET' || req.method === 'HEAD') {
        const rows = query(table, url.searchParams);
        if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
          return rows.length ? send(200, rows[0]) : send(406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
        }
        return send(200, rows, { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
      }
      return send(201, []);
    }
    send(404, { error: 'not mocked' });
  });
}).listen(54321, () => console.log('mock supabase on :54321'));
