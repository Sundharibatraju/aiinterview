import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

export function createPostgresDatabase() {
  const memDb = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Register uuid & crypto mock extensions if needed by pg-mem
  memDb.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: (memDb.public as any).getType('text'),
      implementation: () => 'u_' + Math.random().toString(36).substring(2, 10),
    });
  });

  memDb.registerExtension('citext', (schema) => {
    // Map citext to text in pg-mem
  });

  return memDb;
}

export class PostgresExecutionService {
  private memDb: any;

  constructor() {
    this.memDb = newDb();
    
    // Register custom functions for pg-mem compatibility
    this.memDb.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0'),
    });

    this.memDb.public.registerFunction({
      name: 'now',
      implementation: () => new Date(),
    });
  }

  public async initialize(): Promise<void> {
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'database/schema.sql'), 'utf-8');

    // Filter out extensions and DO blocks for in-memory parser
    const cleanSchema = schemaSql
      .replace(/CREATE EXTENSION[^\n;]+;/gi, '')
      .replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/gi, (match) => {
        // Parse type enum creation
        const typeMatch = match.match(/CREATE TYPE (\w+) AS ENUM \(([\s\S]*?)\);/i);
        if (typeMatch) {
          return `CREATE TYPE ${typeMatch[1]} AS ENUM (${typeMatch[2].replace(/\n/g, ' ')});`;
        }
        return '';
      })
      .replace(/CITEXT/gi, 'VARCHAR(255)');

    try {
      this.memDb.public.none(cleanSchema);
      console.log('[Postgres Engine] PostgreSQL Schema loaded successfully (Zero fake data mode).');
    } catch (err: any) {
      console.error('[Postgres Engine] Error initializing schema:', err.message);
      throw err;
    }
  }

  public query(sql: string): any[] {
    // In pg-mem, memDb.public.query(sql) returns an object with { rows: [...] } or array
    try {
      const res = this.memDb.public.query(sql);
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.rows)) return res.rows;
      return [res];
    } catch (err: any) {
      console.error('[Postgres Query Error]', err.message);
      throw err;
    }
  }
}

export const postgresService = new PostgresExecutionService();
