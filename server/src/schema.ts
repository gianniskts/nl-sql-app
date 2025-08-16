import type BetterSqlite3 from 'better-sqlite3';

export type ColumnSchema = {
  name: string;
  type: string;
  notnull: boolean;
  defaultValue: any;
  primaryKey: boolean;
};

export type TableSchema = {
  table: string;
  columns: string[];
  columnDetails: ColumnSchema[];
  rowCount?: number;
};

export type DbSchemaSummary = {
  dialect: 'sqlite';
  tables: TableSchema[];
  relationships?: string[];
};

/**
 * Schema introspection that provides detailed metadata
 * for better NL→SQL translation context
 */
export function getSchemaSummary(db: BetterSqlite3.Database): DbSchemaSummary {
  // Get all user tables (excluding system tables)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%' 
    AND name NOT LIKE '_migrations'
    ORDER BY name
  `).all() as { name: string }[];
  
  const result: TableSchema[] = [];
  const relationships: string[] = [];
  
  for (const t of tables) {
    const pragma = db.prepare(`PRAGMA table_info(${t.name})`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;
    
    // Get row count for context (helps with query optimization hints)
    let rowCount: number | undefined;
    try {
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as { count: number };
      rowCount = countResult.count;
    } catch {
      // Table might be empty or have issues
      rowCount = 0;
    }
    
    // Get foreign key information
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all() as Array<{
      table: string;
      from: string;
      to: string;
    }>;
    
    // Document relationships
    for (const fk of foreignKeys) {
      relationships.push(`${t.name}.${fk.from} -> ${fk.table}.${fk.to}`);
    }
    
    // Build column details
    const columnDetails: ColumnSchema[] = pragma.map(p => ({
      name: p.name,
      type: p.type,
      notnull: p.notnull === 1,
      defaultValue: p.dflt_value,
      primaryKey: p.pk === 1
    }));
    
    result.push({ 
      table: t.name, 
      columns: pragma.map(p => p.name),
      columnDetails,
      rowCount
    });
  }
  
  // Get indexes for additional context
  const indexes = db.prepare(`
    SELECT name, tbl_name, sql 
    FROM sqlite_master 
    WHERE type='index' 
    AND name NOT LIKE 'sqlite_%'
  `).all();
  
  // Log schema summary for debugging
  console.log('Schema Summary:');
  result.forEach(t => {
    console.log(`  Table: ${t.table} (${t.rowCount} rows)`);
    t.columnDetails.forEach(c => {
      const flags = [];
      if (c.primaryKey) flags.push('PK');
      if (c.notnull) flags.push('NOT NULL');
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      console.log(`    - ${c.name}: ${c.type}${flagStr}`);
    });
  });
  
  if (relationships.length > 0) {
    console.log('  Relationships:', relationships.join(', '));
  }
  
  return { 
    dialect: 'sqlite', 
    tables: result,
    relationships: relationships.length > 0 ? relationships : undefined
  };
}

/**
 * Generate a human-readable schema description for the NL→SQL processor
 */
export function getSchemaDescription(schema: DbSchemaSummary): string {
  const lines: string[] = [];
  
  lines.push('Database Schema (SQLite):');
  lines.push('');
  
  for (const table of schema.tables) {
    lines.push(`Table: ${table.table}${table.rowCount !== undefined ? ` (${table.rowCount} rows)` : ''}`);
    
    for (const col of table.columnDetails) {
      const parts = [`  - ${col.name}: ${col.type}`];
      if (col.primaryKey) parts.push('PRIMARY KEY');
      if (col.notnull) parts.push('NOT NULL');
      if (col.defaultValue !== null) parts.push(`DEFAULT ${col.defaultValue}`);
      lines.push(parts.join(', '));
    }
    lines.push('');
  }
  
  if (schema.relationships && schema.relationships.length > 0) {
    lines.push('Relationships:');
    schema.relationships.forEach(rel => lines.push(`  - ${rel}`));
  }
  
  return lines.join('\n');
}
