import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleBrain, seedDb, type Db } from "./engine.ts";
import type { BrainRequest, BrainResponse } from "./types.ts";

export type AppConfig = { scriptUrl: string };

const CANDIDATE_DIRS = [
  join("/tmp", "super-admin-sal"),
  join(process.cwd(), "data"),
];

let dataDir = CANDIDATE_DIRS[0];
let memoryDb: Db | null = null;
let memoryCfg: AppConfig = { scriptUrl: "" };
let persist = true;

function storePath() {
  return join(dataDir, "store.json");
}
function configPath() {
  return join(dataDir, "config.json");
}

function ensureDir() {
  if (!persist) return false;
  for (const dir of CANDIDATE_DIRS) {
    try {
      mkdirSync(dir, { recursive: true });
      dataDir = dir;
      return true;
    } catch {
      continue;
    }
  }
  persist = false;
  return false;
}

function atomicWrite(path: string, text: string) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function loadDb(): Db {
  if (memoryDb) return memoryDb;
  if (ensureDir() && existsSync(storePath())) {
    try {
      const raw = JSON.parse(readFileSync(storePath(), "utf8")) as Db;
      if (raw.trips && raw.akses && raw.equipment) {
        memoryDb = raw;
        return raw;
      }
    } catch {
      /* fall through */
    }
  }
  memoryDb = seedDb();
  saveDb(memoryDb);
  return memoryDb;
}

function saveDb(db: Db) {
  memoryDb = db;
  if (!ensureDir()) return;
  try {
    atomicWrite(storePath(), JSON.stringify(db));
  } catch {
    persist = false;
  }
}

export function readConfig(): AppConfig {
  if (memoryCfg.scriptUrl) return memoryCfg;
  if (ensureDir() && existsSync(configPath())) {
    try {
      const raw = JSON.parse(readFileSync(configPath(), "utf8")) as AppConfig;
      memoryCfg = { scriptUrl: typeof raw.scriptUrl === "string" ? raw.scriptUrl.trim() : "" };
      return memoryCfg;
    } catch {
      /* ignore */
    }
  }
  return memoryCfg;
}

export function writeConfig(cfg: AppConfig) {
  memoryCfg = { scriptUrl: cfg.scriptUrl.trim() };
  if (!ensureDir()) return;
  try {
    atomicWrite(configPath(), JSON.stringify(memoryCfg));
  } catch {
    persist = false;
  }
}

let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function runLocalBrain(req: BrainRequest): Promise<BrainResponse> {
  return withLock(() => {
    const db = loadDb();
    const res = handleBrain(db, req);
    saveDb(db);
    return res;
  });
}

async function proxySheets(url: string, req: BrainRequest): Promise<BrainResponse> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(req),
      redirect: "follow",
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as BrainResponse;
    } catch {
      return {
        ok: false,
        message: `Apps Script tidak mengembalikan JSON. Status ${res.status}. ${text.slice(0, 180)}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      message: `Gagal terhubung ke Apps Script: ${err instanceof Error ? err.message : "jaringan"}`,
    };
  }
}

export async function dispatchBrain(req: BrainRequest): Promise<BrainResponse> {
  const cfg = readConfig();
  if (cfg.scriptUrl) {
    const live = await proxySheets(cfg.scriptUrl, req);
    return { ...live, connected: true };
  }
  const local = await runLocalBrain(req);
  return { ...local, connected: false };
}

export async function pingScript(url: string): Promise<BrainResponse> {
  return proxySheets(url, { action: "ping" });
}

export function readCodeGs(): { ok: boolean; source: string; message?: string } {
  const path = join(process.cwd(), "apps-script", "Code.gs");
  if (!existsSync(path)) {
    return { ok: false, source: "", message: "File Code.gs tidak ditemukan." };
  }
  return { ok: true, source: readFileSync(path, "utf8") };
}
