import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

// Execute the real guard SQL against in-memory SQLite, matching D1's interface.
export function guardDatabase(enabled = true) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../museum/guard.sql', import.meta.url), 'utf8'));
  if (enabled) sqlite.exec('UPDATE aimes_museum_guard SET enabled = 1');
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const args = () => /\?\d/.test(sql) ? [Object.fromEntries(values.map((v,i)=>[String(i+1),v]))] : values;
      return {
        bind(...next) { values = next; return this; },
        async first() { return statement.get(...args()) || null; },
        async run() { return statement.run(...args()); }
      };
    }
  };
}
