import { neon } from '@neondatabase/serverless';

let sqlClient;
let schemaReady;

function getSql() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing Neon connection string. Add DATABASE_URL or POSTGRES_URL in Vercel environment variables.');
    }
  if (!sqlClient) sqlClient = neon(connectionString);
  return sqlClient;
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS oh_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date_str TEXT,
        team TEXT,
        venue TEXT,
        event_pw TEXT DEFAULT '',
        btc_members JSONB DEFAULT '[]'::jsonb,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS oh_guests (
        id TEXT PRIMARY KEY,
        event_id TEXT REFERENCES oh_events(id) ON DELETE CASCADE,
        guest_code TEXT,
        system_code TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        prm_name TEXT,
        tcb_region TEXT,
        unit TEXT,
        sih_name TEXT,
        note TEXT,
        companions JSONB DEFAULT '[]'::jsonb,
        checked_in BOOLEAN DEFAULT FALSE,
        checkin_time TEXT,
        checkin_by TEXT,
        cancelled BOOLEAN DEFAULT FALSE,
        cancel_note TEXT,
        walkin BOOLEAN DEFAULT FALSE,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_oh_guests_event_id ON oh_guests(event_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_oh_guests_guest_code ON oh_guests(guest_code)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_oh_events_created_at ON oh_events(created_at DESC)`);
  })();
  return schemaReady;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getSql().query(text, params);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function sendError(res, status, message) {
  send(res, status, { ok: false, error: message });
}

export function rowsFromBody(body) {
  return Array.isArray(body) ? body : [body];
}

export function pickAllowed(input, allowed) {
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  return out;
}

function placeholder(column, index, jsonColumns) {
  return jsonColumns.includes(column) ? `$${index}::jsonb` : `$${index}`;
}

export async function upsertRows(table, columns, rows, jsonColumns = []) {
  if (!rows.length) return;
  const values = [];
  const groups = rows.map((row) => {
    const parts = columns.map((column) => {
      values.push(jsonColumns.includes(column) ? JSON.stringify(row[column] ?? []) : row[column] ?? null);
      return placeholder(column, values.length, jsonColumns);
    });
    return `(${parts.join(', ')})`;
  });
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ');
  await query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${groups.join(', ')}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values
  );
}

export async function patchRow(table, id, fields, jsonColumns = []) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const values = [];
  const sets = keys.map((key) => {
    values.push(jsonColumns.includes(key) ? JSON.stringify(fields[key] ?? []) : fields[key] ?? null);
    return `${key} = ${placeholder(key, values.length, jsonColumns)}`;
  });
  values.push(id);
  await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
}
