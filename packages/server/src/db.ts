import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await pool.query(text, params as any[]);
    return result.rows as T[];
  } catch (err) {
    console.error('Database error:', (err as Error).message);
    throw new Error('A database error occurred');
  }
}

interface TransactionClient {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}

export async function withTransaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txClient: TransactionClient = {
      query: async <R>(text: string, params?: unknown[]): Promise<R[]> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await client.query(text, params as any[]);
        return result.rows as R[];
      },
    };
    const result = await fn(txClient);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
