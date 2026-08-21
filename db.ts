/**
 * PostgreSQL Database Helper using Supabase (node-postgres)
 * Provides Firestore-like helpers for easy migration.
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    if (!DATABASE_URL) {
      throw new Error('POSTGRES_URL or DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    console.log('PostgreSQL pool created (Supabase).');
  }
  return pool;
}

export async function query(text: string, params: any[] = []): Promise<any[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne(text: string, params: any[] = []): Promise<any | undefined> {
  const rows = await query(text, params);
  return rows[0];
}

export async function execute(text: string, params: any[] = []): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

// ============================================================================
// Firestore-compatible helpers
// ============================================================================

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj !== 'object') return obj;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[snakeKey] = toSnakeCase(value);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map(item => typeof item === 'object' && item !== null ? toSnakeCase(item) : item);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== 'object') return obj;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(item => typeof item === 'object' && item !== null ? toCamelCase(item) : item);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// ============================================================================
// Schema introspection: per-table primary keys and real column names.
// Keeps the Firestore-style helpers safe against extra/unknown fields and
// non-'id' primary keys (e.g. settings.canteen_id, otp_store.email).
// ============================================================================

/** Tables whose primary key is NOT 'id'. */
const TABLE_PK: Record<string, string> = {
  settings: 'canteen_id',
  otp_store: 'email',
};

function getPkColumn(table: string): string {
  return TABLE_PK[table] || 'id';
}

const tableColumnsCache = new Map<string, Set<string>>();

async function getTableColumns(table: string): Promise<Set<string> | null> {
  const cached = tableColumnsCache.get(table);
  if (cached) return cached;
  try {
    const rows = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (rows.length === 0) return null;
    const cols = new Set(rows.map((r: any) => r.column_name));
    tableColumnsCache.set(table, cols);
    return cols;
  } catch {
    return null;
  }
}

function filterKnownColumns(snakeData: Record<string, any>, cols: Set<string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(snakeData)) {
    if (cols.has(key)) result[key] = value;
  }
  return result;
}

/** pgGetById('users', 'test@gmail.com') — equivalent to db.collection('users').doc(id).get() */
export async function pgGetById(table: string, id: string): Promise<any | null> {
  const pk = getPkColumn(table);
  const row = await queryOne(`SELECT * FROM ${table} WHERE ${pk} = $1`, [id]);
  return row ? toCamelCase(row) : null;
}

/** pgGetAll('colleges') — equivalent to db.collection('colleges').get() */
export async function pgGetAll(table: string): Promise<any[]> {
  const rows = await query(`SELECT * FROM ${table}`);
  return rows.map(toCamelCase);
}

/** pgGetWhere('items', {canteenId: 'canteen_001'}) */
export async function pgGetWhere(table: string, conditions: Record<string, any>): Promise<any[]> {
  const keys = Object.keys(conditions);
  if (keys.length === 0) return pgGetAll(table);
  const whereClauses = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`);
  const values = keys.map(k => conditions[k]);
  const rows = await query(`SELECT * FROM ${table} WHERE ${whereClauses.join(' AND ')}`, values);
  return rows.map(toCamelCase);
}

/** pgGetWhereOrdered('items', {canteenId: 'c_001'}, 'createdAt', 'desc', 50) */
export async function pgGetWhereOrdered(
  table: string,
  conditions: Record<string, any>,
  orderBy: string,
  order: 'asc' | 'desc' = 'asc',
  limit?: number
): Promise<any[]> {
  const keys = Object.keys(conditions);
  let sql = `SELECT * FROM ${table}`;
  const values: any[] = [];
  if (keys.length > 0) {
    const whereClauses = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`);
    values.push(...keys.map(k => conditions[k]));
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  sql += ` ORDER BY ${camelToSnake(orderBy)} ${order}`;
  if (limit) sql += ` LIMIT ${limit}`;
  const rows = await query(sql, values);
  return rows.map(toCamelCase);
}

/** pgSet('users', 'test@gmail.com', userData) — upsert */
export async function pgSet(table: string, id: string, data: any): Promise<void> {
  const pk = getPkColumn(table);
  const snakeData = toSnakeCase({ ...data });
  snakeData[pk] = id;

  // Drop fields that don't exist as real columns (schema-drift safety).
  const cols = await getTableColumns(table);
  const knownData = cols ? filterKnownColumns(snakeData, cols) : snakeData;

  const columns = Object.keys(knownData);
  if (!columns.includes(pk)) return; // cannot upsert without the key

  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const updateColumns = columns.filter(c => c !== pk);
  const values = columns.map(c => {
    const v = knownData[c];
    // node-postgres doesn't auto-serialize JS objects/arrays for JSONB columns
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  });

  let sql: string;
  if (updateColumns.length === 0) {
    sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${pk}) DO NOTHING`;
  } else {
    const updateClauses = updateColumns.map(c => `${c} = $${columns.indexOf(c) + 1}`);
    sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${pk}) DO UPDATE SET ${updateClauses.join(', ')}`;
  }
  await execute(sql, values);
}

/** pgUpdate('users', 'test@gmail.com', {role: 'admin'}) — partial update */
export async function pgUpdate(table: string, id: string, data: any): Promise<void> {
  const pk = getPkColumn(table);
  let snakeData = toSnakeCase(data);
  const cols = await getTableColumns(table);
  if (cols) snakeData = filterKnownColumns(snakeData, cols);
  delete snakeData[pk]; // never overwrite the key itself
  const columns = Object.keys(snakeData);
  if (columns.length === 0) return;
  const setClauses = columns.map((c, i) => `${c} = $${i + 1}`);
  const values = [...columns.map(c => {
    const v = snakeData[c];
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }), id];
  await execute(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${pk} = $${columns.length + 1}`, values);
}

/** pgDelete('users', 'test@gmail.com') */
export async function pgDelete(table: string, id: string): Promise<void> {
  const pk = getPkColumn(table);
  await execute(`DELETE FROM ${table} WHERE ${pk} = $1`, [id]);
}

/** pgDeleteWhere('items', {canteenId: 'c_001'}) */
export async function pgDeleteWhere(table: string, conditions: Record<string, any>): Promise<void> {
  const keys = Object.keys(conditions);
  if (keys.length === 0) return;
  const whereClauses = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`);
  const values = keys.map(k => conditions[k]);
  await execute(`DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')}`, values);
}

/** pgIncrement('items', 'item_001', 'bookedToday', 1) */
export async function pgIncrement(table: string, id: string, column: string, amount: number): Promise<void> {
  const pk = getPkColumn(table);
  const col = camelToSnake(column);
  await execute(`UPDATE ${table} SET ${col} = ${col} + $1 WHERE ${pk} = $2`, [amount, id]);
}

/** pgGetByEmail('users', 'test@gmail.com') — query by email field */
export async function pgGetByEmail(table: string, email: string): Promise<any | null> {
  const row = await queryOne(`SELECT * FROM ${table} WHERE email = $1`, [email.toLowerCase().trim()]);
  return row ? toCamelCase(row) : null;
}

/** Check if PostgreSQL is available */
export async function isPgAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Initialize schema from SQL file */
export async function initSchema(schemaSql: string): Promise<void> {
  const client = await getPool().connect();
  try {
    const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Schema init error:', e.message);
        }
      }
    }
  } finally {
    client.release();
  }
}

export { getPool, camelToSnake, snakeToCamel, toSnakeCase, toCamelCase };
