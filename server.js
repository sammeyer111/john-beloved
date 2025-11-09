// server.js
"use strict";

/**
 * Todo List - Read/Write JSON API (synchronous, no deps)
 * ------------------------------------------------------------
 * Goals:
 *   - Store todos in data/todos.json
 *   - Synchronous FS, no promises, no frameworks
 *   - Simple endpoints that return JSON only
 *
 * Start:
 *   node server.js --port 4102
 *   (env PORT also supported)
 *
 * Endpoints (all GET, all JSON):
 *   1)  /api/health
 *   2)  /api/list?done=true|false&q=keyword
 *   3)  /api/item/get?id=123
 *   4)  /api/item/add?text=Buy%20milk&done=false
 *   5)  /api/item/update?id=123&text=Milk&done=true
 *   6)  /api/item/toggle?id=123
 *   7)  /api/item/delete?id=123
 *   8)  /api/clear-completed
 *   9)  /api/stats
 *
 * Static files:
 *   Serves public/index.html, public/logic.js, public/style.css
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

/* =============================== config =============================== */

const APP_DIR = process.cwd();
const PUBLIC_DIR = path.join(APP_DIR, "public");
const DATA_DIR = path.join(APP_DIR, "data");
const DB_FILE = path.join(DATA_DIR, "todos.json");

const PORT = (() => {
  const i = process.argv.indexOf("--port");
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  if (process.env.PORT) return Number(process.env.PORT);
  return 4102;
})();

/* =============================== helpers ============================== */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
  res.end(body);
}

function send404(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function serveStatic(res, requestPath) {
  const rel = requestPath === "/" ? "/index.html" : requestPath;
  const safeRel = String(rel).replace(/^\/+/, "");
  const abs = path.resolve(path.join(PUBLIC_DIR, safeRel));
  const root = path.resolve(PUBLIC_DIR) + path.sep;
  if (!abs.startsWith(root)) return send404(res);
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) return send404(res);
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(fs.readFileSync(abs));
  } catch {
    send404(res);
  }
}

function nowISO() {
  return new Date().toISOString();
}

function logLine(ts, method, pathWithQs, status, ms, bytes) {
  const size = bytes != null ? " " + bytes + "b" : "";
  console.log(ts + " " + method + " " + pathWithQs + " -> " + status + " " + ms + "ms" + size);
}

/* ============================ data storage ============================ */

function initDB() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DB_FILE)) {
    const seed = { nextId: 1, items: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

function readDB() {
  initDB();
  try {
    const txt = fs.readFileSync(DB_FILE, "utf8");
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== "object") throw new Error("bad db");
    if (!Array.isArray(obj.items)) obj.items = [];
    if (!Number.isInteger(obj.nextId) || obj.nextId < 1) obj.nextId = 1;
    return obj;
  } catch {
    // Reset on parse failure
    const seed = { nextId: 1, items: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function writeDB(db) {
  // Simple atomic-ish write: write temp then rename
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}

/* ================================ API ================================= */

/**
 * 1) /api/health
 */
function apiHealth(res) {
  const okDir = fs.existsSync(DATA_DIR);
  const okFile = fs.existsSync(DB_FILE);
  const db = readDB();
  sendJSON(res, okDir && okFile ? 200 : 500, {
    ok: okDir && okFile,
    app: "todo-list",
    appDir: APP_DIR,
    dataDir: DATA_DIR,
    dbFile: DB_FILE,
    items: db.items.length,
    nextId: db.nextId,
  });
}

/**
 * 2) /api/list?done=true|false&q=keyword
 * Returns the list, optionally filtered by done and substring match on text.
 */
function apiList(res, q) {
  const db = readDB();
  let items = db.items.slice();

  if (q.done === "true") items = items.filter((it) => !!it.done);
  if (q.done === "false") items = items.filter((it) => !it.done);

  const needle = (q.q || "").toString().trim().toLowerCase();
  if (needle)
    items = items.filter(
      (it) =>
        String(it.text || "")
          .toLowerCase()
          .indexOf(needle) !== -1
    );

  // Stable order: id ascending
  items.sort((a, b) => a.id - b.id);

  sendJSON(res, 200, { ok: true, items });
}

/**
 * 3) /api/item/get?id=123
 */
function apiItemGet(res, q) {
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendJSON(res, 400, { ok: false, error: "id must be a positive integer" });
  }
  const db = readDB();
  const it = db.items.find((x) => x.id === id);
  if (!it) return sendJSON(res, 404, { ok: false, error: "item not found", id });
  sendJSON(res, 200, { ok: true, item: it });
}

/**
 * 4) /api/item/add?text=Buy%20milk&done=false
 * Adds a new item. Text is required. done defaults to false.
 */
function apiItemAdd(res, q) {
  let text = (q.text || "").toString().trim();
  if (!text) return sendJSON(res, 400, { ok: false, error: "text is required" });
  if (text.length > 500) text = text.slice(0, 500);

  const done = String(q.done || "false").toLowerCase() === "true";

  const db = readDB();
  const id = db.nextId++;
  const ts = nowISO();

  const item = { id, text, done, createdAt: ts, updatedAt: ts };
  db.items.push(item);
  writeDB(db);

  sendJSON(res, 200, { ok: true, item });
}

/**
 * 5) /api/item/update?id=123&text=Milk&done=true
 * Updates text and/or done. At least one must be provided.
 */
function apiItemUpdate(res, q) {
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendJSON(res, 400, { ok: false, error: "id must be a positive integer" });
  }

  const hasText = Object.prototype.hasOwnProperty.call(q, "text");
  const hasDone = Object.prototype.hasOwnProperty.call(q, "done");
  if (!hasText && !hasDone) {
    return sendJSON(res, 400, { ok: false, error: "provide text and/or done to update" });
  }

  const db = readDB();
  const it = db.items.find((x) => x.id === id);
  if (!it) return sendJSON(res, 404, { ok: false, error: "item not found", id });

  if (hasText) {
    let text = (q.text || "").toString().trim();
    if (!text) return sendJSON(res, 400, { ok: false, error: "text cannot be empty" });
    if (text.length > 500) text = text.slice(0, 500);
    it.text = text;
  }
  if (hasDone) {
    it.done = String(q.done).toLowerCase() === "true";
  }
  it.updatedAt = nowISO();
  writeDB(db);

  sendJSON(res, 200, { ok: true, item: it });
}

/**
 * 6) /api/item/toggle?id=123
 * Flips the done flag.
 */
function apiItemToggle(res, q) {
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendJSON(res, 400, { ok: false, error: "id must be a positive integer" });
  }
  const db = readDB();
  const it = db.items.find((x) => x.id === id);
  if (!it) return sendJSON(res, 404, { ok: false, error: "item not found", id });
  it.done = !it.done;
  it.updatedAt = nowISO();
  writeDB(db);
  sendJSON(res, 200, { ok: true, item: it });
}

/**
 * 7) /api/item/delete?id=123
 * Removes an item.
 */
function apiItemDelete(res, q) {
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendJSON(res, 400, { ok: false, error: "id must be a positive integer" });
  }
  const db = readDB();
  const idx = db.items.findIndex((x) => x.id === id);
  if (idx === -1) return sendJSON(res, 404, { ok: false, error: "item not found", id });
  const [removed] = db.items.splice(idx, 1);
  writeDB(db);
  sendJSON(res, 200, { ok: true, removed });
}

/**
 * 8) /api/clear-completed
 * Deletes all items with done=true. Returns count removed.
 */
function apiClearCompleted(res) {
  const db = readDB();
  const before = db.items.length;
  db.items = db.items.filter((x) => !x.done);
  const removed = before - db.items.length;
  writeDB(db);
  sendJSON(res, 200, { ok: true, removed });
}

/**
 * 9) /api/stats
 * Counts for summary UI.
 */
function apiStats(res) {
  const db = readDB();
  const total = db.items.length;
  const done = db.items.filter((x) => x.done).length;
  const open = total - done;
  sendJSON(res, 200, { ok: true, total, open, done, nextId: db.nextId });
}

/* ============================== HTTP router ============================ */

const server = http.createServer((req, res) => {
  try {
    const u = url.parse(req.url, true);
    const p = u.pathname || "/";
    const start = Date.now();

    // wrap res.end to count bytes
    let bytesSent = 0;
    const _end = res.end;
    res.end = function (chunk, encoding, cb) {
      try {
        if (typeof chunk === "string") {
          bytesSent += Buffer.byteLength(chunk, encoding || "utf8");
        } else if (Buffer.isBuffer(chunk)) {
          bytesSent += chunk.length;
        }
      } catch {}
      return _end.call(this, chunk, encoding, cb);
    };

    // log after finish
    res.on("finish", () => {
      const ms = Date.now() - start;
      const ts = new Date().toISOString();
      const pathWithQs = u.pathname + (u.search || "");
      logLine(ts, req.method, pathWithQs, res.statusCode, ms, bytesSent);
    });

    // API routes
    if (p === "/api/health") return apiHealth(res);
    if (p === "/api/list") return apiList(res, u.query);
    if (p === "/api/item/get") return apiItemGet(res, u.query);
    if (p === "/api/item/add") return apiItemAdd(res, u.query);
    if (p === "/api/item/update") return apiItemUpdate(res, u.query);
    if (p === "/api/item/toggle") return apiItemToggle(res, u.query);
    if (p === "/api/item/delete") return apiItemDelete(res, u.query);
    if (p === "/api/clear-completed") return apiClearCompleted(res);
    if (p === "/api/stats") return apiStats(res);

    // Static files
    return serveStatic(res, p);
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
});

/* ================================ start ================================ */

server.listen(PORT, () => {
  console.log("todo-list listening on http://127.0.0.1:" + PORT + "/");
  console.log("app dir  : " + APP_DIR);
  console.log("data dir : " + DATA_DIR);
  console.log("db file  : " + DB_FILE);
});
