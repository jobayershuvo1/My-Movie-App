import { Router } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

// Vercel Functions only allow runtime writes in /tmp. This keeps the demo
// deploy functional, although /tmp data is ephemeral between function instances.
const dataDir = process.env.VERCEL
  ? path.join('/tmp', 'cinevault-data')
  : path.join(process.cwd(), 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

export const sqlitePath = path.join(dataDir, 'cinevault.db');
export const uploadsPath = uploadsDir;

const db = new Database(sqlitePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    poster_url TEXT,
    cover_url TEXT,
    trailer_url TEXT,
    release_year INTEGER,
    imdb_rating REAL,
    runtime INTEGER,
    language TEXT,
    country TEXT,
    download_enabled INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    trending INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'genre'
  );
  CREATE TABLE IF NOT EXISTS movie_categories (
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, category_id)
  );
  CREATE TABLE IF NOT EXISTS download_links (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    server_name TEXT NOT NULL,
    url TEXT NOT NULL,
    quality TEXT NOT NULL,
    file_size TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movie_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    year INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS download_reports (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL REFERENCES download_links(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movie_ratings (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    review_text TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(movie_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  );
`);

const TABLE_COLUMNS: Record<string, string[]> = {
  profiles: ['id', 'email', 'password_hash', 'full_name', 'avatar_url', 'role', 'created_at', 'updated_at'],
  movies: ['id', 'title', 'description', 'poster_url', 'cover_url', 'trailer_url', 'release_year', 'imdb_rating', 'runtime', 'language', 'country', 'download_enabled', 'featured', 'trending', 'published', 'created_at', 'updated_at'],
  categories: ['id', 'name', 'slug', 'type'],
  movie_categories: ['movie_id', 'category_id'],
  download_links: ['id', 'movie_id', 'server_name', 'url', 'quality', 'file_size', 'status', 'clicks', 'created_at'],
  movie_requests: ['id', 'user_id', 'title', 'year', 'status', 'notes', 'created_at'],
  download_reports: ['id', 'link_id', 'user_id', 'issue_type', 'status', 'created_at'],
  movie_ratings: ['id', 'movie_id', 'user_id', 'rating', 'review_text', 'created_at'],
  notifications: ['id', 'user_id', 'title', 'message', 'type', 'read', 'created_at'],
  activity_logs: ['id', 'user_id', 'action', 'details', 'ip_address', 'metadata', 'created_at'],
};

const BOOLEAN_COLUMNS: Record<string, string[]> = {
  movies: ['download_enabled', 'featured', 'trending', 'published'],
  notifications: ['read'],
};

const PUBLIC_PROFILE_COLUMNS = ['id', 'email', 'full_name', 'avatar_url', 'role', 'created_at', 'updated_at'];
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string) {
  if (!stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function seed() {
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, type) VALUES (?, ?, ?, ?)');
  for (const name of ['Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Animation']) {
    insertCategory.run(uuid(), name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'genre');
  }

  const demoEmail = 'admin@cinevault.local';
  if (!db.prepare('SELECT id FROM profiles WHERE email = ?').get(demoEmail)) {
    const timestamp = now();
    db.prepare(`INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`)
      .run(uuid(), demoEmail, hashPassword('admin123'), 'Local Admin', timestamp, timestamp);
  }

  const configuredEmail = String(process.env.LOCAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = String(process.env.LOCAL_ADMIN_PASSWORD || '');
  if (configuredEmail && configuredPassword.length >= 6) {
    const existing: any = db.prepare('SELECT id FROM profiles WHERE email = ?').get(configuredEmail);
    const timestamp = now();
    if (existing) {
      db.prepare(`UPDATE profiles SET password_hash = ?, full_name = ?, role = 'super_admin', updated_at = ? WHERE id = ?`)
        .run(hashPassword(configuredPassword), 'Super Admin', timestamp, existing.id);
    } else {
      db.prepare(`INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`)
        .run(uuid(), configuredEmail, hashPassword(configuredPassword), 'Super Admin', timestamp, timestamp);
    }
  }
}
seed();

function cleanRecord(table: string, input: Record<string, unknown>, isInsert = false) {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) throw new Error(`Unsupported table: ${table}`);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key) || key === 'password_hash') continue;
    if (BOOLEAN_COLUMNS[table]?.includes(key)) result[key] = value ? 1 : 0;
    else if (key === 'metadata' && value != null && typeof value !== 'string') result[key] = JSON.stringify(value);
    else result[key] = value;
  }
  if (isInsert) {
    if (allowed.includes('id') && !result.id) result.id = uuid();
    if (allowed.includes('created_at') && !result.created_at) result.created_at = now();
    if (allowed.includes('updated_at') && !result.updated_at) result.updated_at = now();
  } else if (allowed.includes('updated_at')) {
    result.updated_at = now();
  }
  return result;
}

function publicRow(table: string, row: any) {
  if (!row) return row;
  const output = { ...row };
  delete output.password_hash;
  for (const column of BOOLEAN_COLUMNS[table] || []) output[column] = Boolean(output[column]);
  if (table === 'activity_logs' && typeof output.metadata === 'string') {
    try { output.metadata = JSON.parse(output.metadata); } catch { /* keep legacy text */ }
  }
  return output;
}

function relatedProfile(userId: string | null) {
  if (!userId) return null;
  return db.prepare(`SELECT ${PUBLIC_PROFILE_COLUMNS.join(', ')} FROM profiles WHERE id = ?`).get(userId) || null;
}

function enrich(table: string, row: any) {
  const item = publicRow(table, row);
  if (['activity_logs', 'movie_requests', 'movie_ratings'].includes(table)) item.profiles = relatedProfile(item.user_id);
  if (table === 'download_links') {
    item.movies = db.prepare('SELECT title FROM movies WHERE id = ?').get(item.movie_id) || null;
  }
  if (table === 'download_reports') {
    item.download_links = db.prepare('SELECT url, server_name, movie_id FROM download_links WHERE id = ?').get(item.link_id) || null;
    item.profiles = relatedProfile(item.user_id);
  }
  return item;
}

type Filter = { column: string; operator: 'eq' | 'neq' | 'ilike'; value: unknown };

function assertColumn(table: string, column: string) {
  if (!TABLE_COLUMNS[table]?.includes(column) || column === 'password_hash') throw new Error(`Unsupported column: ${column}`);
  return column;
}

function buildWhere(table: string, filters: Filter[] = [], orExpression?: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  for (const filter of filters) {
    const column = assertColumn(table, filter.column);
    if (filter.operator === 'ilike') {
      clauses.push(`LOWER(${column}) LIKE LOWER(?)`);
      values.push(filter.value);
    } else {
      clauses.push(`${column} ${filter.operator === 'neq' ? '!=' : '='} ?`);
      values.push(BOOLEAN_COLUMNS[table]?.includes(column) ? (filter.value ? 1 : 0) : filter.value);
    }
  }
  if (orExpression) {
    const orParts: string[] = [];
    for (const raw of orExpression.split(',')) {
      const [column, op, ...rest] = raw.split('.');
      assertColumn(table, column);
      if (op === 'is' && rest.join('.') === 'null') orParts.push(`${column} IS NULL`);
      else if (op === 'eq') {
        orParts.push(`${column} = ?`);
        values.push(rest.join('.'));
      }
    }
    if (orParts.length) clauses.push(`(${orParts.join(' OR ')})`);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}

function selectedColumns(table: string, selection?: string) {
  if (!selection || selection.trim() === '*' || selection.includes('(')) return '*';
  const columns = selection.split(',').map(column => column.trim()).filter(Boolean);
  if (!columns.length) return '*';
  columns.forEach(column => assertColumn(table, column));
  return columns.join(', ');
}

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', database: 'sqlite', path: sqlitePath }));

router.post('/query', (req, res) => {
  try {
    const { table, action = 'select', payload, filters = [], orExpression, order, limit, selection, head, count: countMode } = req.body;
    if (!TABLE_COLUMNS[table]) return res.status(400).json({ error: { message: `Unsupported table: ${table}` } });
    const where = buildWhere(table, filters, orExpression);
    let rows: any[] = [];

    if (action === 'select') {
      const columns = selectedColumns(table, selection);
      let sql = `SELECT ${columns} FROM ${table}${where.sql}`;
      if (order?.column) sql += ` ORDER BY ${assertColumn(table, order.column)} ${order.ascending === false ? 'DESC' : 'ASC'}`;
      if (Number.isInteger(limit) && limit > 0) sql += ` LIMIT ${limit}`;
      rows = db.prepare(sql).all(...where.values);
    } else if (action === 'insert' || action === 'upsert') {
      const inputs = (Array.isArray(payload) ? payload : [payload]).map(item => cleanRecord(table, item || {}, true));
      const insertOne = db.transaction((record: Record<string, unknown>) => {
        const columns = Object.keys(record);
        const placeholders = columns.map(() => '?').join(', ');
        let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        if (action === 'upsert') {
          const conflict = table === 'movie_ratings' ? '(movie_id, user_id)' : table === 'profiles' ? '(id)' : '(id)';
          const updates = columns.filter(column => !['id', 'created_at', 'movie_id', 'user_id'].includes(column)).map(column => `${column}=excluded.${column}`);
          sql += ` ON CONFLICT ${conflict} DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`;
        }
        db.prepare(sql).run(...columns.map(column => record[column]));
        const key = table === 'movie_ratings'
          ? db.prepare('SELECT * FROM movie_ratings WHERE movie_id = ? AND user_id = ?').get(record.movie_id, record.user_id)
          : db.prepare(`SELECT * FROM ${table} WHERE ${TABLE_COLUMNS[table].includes('id') ? 'id = ?' : Object.keys(record)[0] + ' = ?'}`).get(record.id ?? record[Object.keys(record)[0]]);
        return key;
      });
      rows = inputs.map(record => insertOne(record));
    } else if (action === 'update') {
      const record = cleanRecord(table, payload || {}, false);
      const columns = Object.keys(record);
      if (!columns.length) throw new Error('No valid values to update');
      db.prepare(`UPDATE ${table} SET ${columns.map(column => `${column} = ?`).join(', ')}${where.sql}`)
        .run(...columns.map(column => record[column]), ...where.values);
      rows = db.prepare(`SELECT * FROM ${table}${where.sql}`).all(...where.values);
    } else if (action === 'delete') {
      rows = db.prepare(`SELECT * FROM ${table}${where.sql}`).all(...where.values);
      db.prepare(`DELETE FROM ${table}${where.sql}`).run(...where.values);
    } else {
      throw new Error(`Unsupported action: ${action}`);
    }

    const data = head ? null : rows.map(row => enrich(table, row));
    res.json({ data, count: countMode === 'exact' ? rows.length : null, error: null });
  } catch (error: any) {
    console.error('SQLite query failed:', error);
    res.status(400).json({ data: null, count: null, error: { message: error.message || 'SQLite query failed' } });
  }
});

router.post('/auth/register', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const fullName = String(req.body.fullName || '').trim() || null;
    if (!email.includes('@') || password.length < 6) throw new Error('Enter a valid email and a password with at least 6 characters.');
    if (db.prepare('SELECT id FROM profiles WHERE email = ?').get(email)) throw new Error('An account with this email already exists.');
    const id = uuid();
    const timestamp = now();
    const superAdminEmail = (process.env.VITE_SUPER_ADMIN_EMAIL || 'jobayershuvo1122@gmail.com').toLowerCase();
    const role = email === superAdminEmail ? 'super_admin' : 'user';
    db.prepare(`INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, email, hashPassword(password), fullName, role, timestamp, timestamp);
    const user = { id, email, user_metadata: { full_name: fullName }, created_at: timestamp };
    res.json({ data: { user, session: { user, access_token: uuid() } }, error: null });
  } catch (error: any) {
    res.status(400).json({ data: { user: null, session: null }, error: { message: error.message } });
  }
});

router.post('/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const profile: any = db.prepare('SELECT * FROM profiles WHERE email = ?').get(email);
  if (!profile || !verifyPassword(String(req.body.password || ''), profile.password_hash)) {
    return res.status(401).json({ data: { user: null, session: null }, error: { message: 'Invalid email or password.' } });
  }
  const user = { id: profile.id, email: profile.email, user_metadata: { full_name: profile.full_name }, created_at: profile.created_at };
  res.json({ data: { user, session: { user, access_token: uuid() } }, error: null });
});

router.post('/auth/password', (req, res) => {
  try {
    const id = String(req.body.userId || '');
    const password = String(req.body.password || '');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!db.prepare('SELECT id FROM profiles WHERE id = ?').get(id)) throw new Error('User not found.');
    db.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(password), now(), id);
    res.json({ data: {}, error: null });
  } catch (error: any) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

router.post('/upload', (req, res) => {
  try {
    const safePath = String(req.body.path || '').replace(/\\/g, '/').split('/').filter(part => part && part !== '..').join('/');
    const match = String(req.body.dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!safePath || !match) throw new Error('Invalid upload payload.');
    const destination = path.join(uploadsDir, safePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(match[2], 'base64'));
    res.json({ data: { path: safePath, publicUrl: `/uploads/${safePath}` }, error: null });
  } catch (error: any) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

export default router;
