import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const projectRoot = path.resolve(process.cwd());
export const dataDir = path.join(projectRoot, "data");
export const uploadDir = path.join(projectRoot, "uploads");
export const exportDir = path.join(projectRoot, "exports");
export const dbPath = path.join(dataDir, "acr_ac_editor.sqlite3");

export function ensureDirs() {
  for (const dir of [dataDir, uploadDir, exportDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function openDb() {
  ensureDirs();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schemaPath = path.join(projectRoot, "server", "schema.sql");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  return db;
}
