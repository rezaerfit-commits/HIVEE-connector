import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "../config/env.js";
import { runMigrations } from "./migrations.js";

export type DB = Database.Database;

export function openDb(env: Env): DB {
  fs.mkdirSync(env.DATA_DIR, { recursive: true });
  const dbPath = path.join(env.DATA_DIR, "connector.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
