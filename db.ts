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

/** pgGetById('users', 'test@gmail.com') — equivalent to db.collection('users').doc(id).get() */
export async function pgGetById(table: string, id: string): Promise<any | null> {
  const row = await queryOne(`SELECT * FROM ${table} WHERE id = $1`, [id]);
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
  const snakeData = toSnakeCase({ ...data, id });
  const columns = Object.keys(snakeData);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const updateClauses = columns.filter(c => c !== 'id').map(c => `${c} = $${columns.indexOf(c) + 1}`);
  const values = columns.map(c => {
    const v = snakeData[c];
    // node-postgres doesn't auto-serialize JS objects/arrays for JSONB columns
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  });
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updateClauses.join(', ')}`;
  await execute(sql, values);
}

/** pgUpdate('users', 'test@gmail.com', {role: 'admin'}) — partial update */
export async function pgUpdate(table: string, id: string, data: any): Promise<void> {
  const snakeData = toSnakeCase(data);
  const columns = Object.keys(snakeData);
  if (columns.length === 0) return;
  const setClauses = columns.map((c, i) => `${c} = $${i + 1}`);
  const values = [...columns.map(c => {
    const v = snakeData[c];
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }), id];
  await execute(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $${columns.length + 1}`, values);
}

/** pgDelete('users', 'test@gmail.com') */
export async function pgDelete(table: string, id: string): Promise<void> {
  await execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
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
  await execute(`UPDATE ${table} SET ${camelToSnake(column)} = ${camelToSnake(column)} + $1 WHERE id = $2`, [amount, id]);
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
