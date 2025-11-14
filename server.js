// server.js
"use strict";

/**
 * Bible Vision - Read-only JSON API
 * ------------------------------------------------------------
 * Goals:
 *   - Only read from world_english_bible/ (no writes, no POST)
 *   - Synchronous, dependency-free, JSON-only
 *   - Simple endpoints your logic.js can build on
 *
 * Directory expectation:
 *   PROJECT_ROOT/world_english_bible/*.txt   (e.g., 002_GEN_01.txt)
 *
 * Start:
 *   node server.js --port 4101
 *   (env PORT also supported)
 *
 * Endpoints (all GET, all JSON):
 *   1)  /api/health
 *   2)  /api/books
 *   3)  /api/book/chapters?book=GEN
 *   4)  /api/book/meta?book=GEN
 *   5)  /api/chapter?book=GEN&chapter=1
 *   6)  /api/chapter/verses?book=GEN&chapter=1
 *   7)  /api/verse/random?seed=&book=GEN&chapter=1
 *   8)  /api/search?q=light&book=GEN&limit=25
 *   9)  /api/files
 *   10) /api/stats
 *   11) /api/range?book=GEN&from=1&to=3
 *   12) /api/verse?book=GEN&chapter=1&verse=3
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* =============================== config =============================== */

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findProjectRoot(startDir) {
  // climb up looking for both data/ and world_english_bible/ to match your project layout
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const hasData = isDir(path.join(dir, "data"));
    const hasWeb = isDir(path.join(dir, "world_english_bible"));
    if (hasData && hasWeb) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback: if not found, just use startDir
  return startDir;
}

const APP_DIR = process.cwd();
const PROJECT_ROOT = findProjectRoot(APP_DIR);
const PUBLIC_DIR = path.join(APP_DIR, "public");
const BIBLE_DIR = path.join(PROJECT_ROOT, "world_english_bible");

const PORT = (() => {
  const i = process.argv.indexOf("--port");
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  if (process.env.PORT) return Number(process.env.PORT);
  return 4101;
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

/* ============================ Bible utilities =========================== */

// File pattern: 015_PSA_144.txt or 015_2CH_07.txt
const FILE_RE = /^(\d{3})_((?:[1-3][A-Z]{2}|[A-Z]{3}))_(\d{2,3})\.txt$/;

function listChapterFiles() {
  try {
    return fs
      .readdirSync(BIBLE_DIR)
      .filter((f) => FILE_RE.test(f))
      .sort();
  } catch {
    return [];
  }
}

function parseChapterFile(filename) {
  // console.log("trying to parse: ", filename);
  const m = FILE_RE.exec(filename);
  if (!m) return null;
  const book = m[2]; // e.g., GEN
  const chapter = String(Number(m[3])); // "01" -> "1"
  const full = path.join(BIBLE_DIR, filename);
  let content = "";
  try {
    content = fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
  const verses = content.split(/\r?\n/).slice(2);

  return { book, chapter: Number(chapter), verses, sourceFile: filename };
}

function pickRandom(arr) {
  if (!arr || !arr.length) return { index: -1, item: null };
  const index = Math.floor(Math.random() * arr.length);
  return { index, item: arr[index] };
}

function indexBooks() {
  // { GEN: { chapters: [1,2,...], files: ["002_GEN_01.txt", ...] }, ... }
  const idx = {};
  const files = listChapterFiles();
  for (const f of files) {
    const m = FILE_RE.exec(f);
    if (!m) continue;
    const book = m[2];
    const chap = Number(m[3]);
    if (!idx[book]) idx[book] = { chapters: [], files: [] };
    idx[book].files.push(f);
    idx[book].chapters.push(chap);
  }
  // normalize chapter arrays to sorted unique numbers
  for (const b in idx) {
    const uniq = Array.from(new Set(idx[b].chapters)).sort((a, b) => a - b);
    idx[b].chapters = uniq;
  }
  return idx;
}

function countVersesInFile(filename) {
  const parsed = parseChapterFile(filename);
  return parsed ? parsed.verses.length : 0;
}

/* ================================ API ================================== */

/**
 * 1) /api/health
 * Summary about availability and counts.
 */
function apiHealth(res) {
  const okBible = isDir(BIBLE_DIR);
  const files = okBible ? listChapterFiles().length : 0;
  const ok = okBible && files > 0;
  sendJSON(res, ok ? 200 : 500, {
    ok,
    app: "bible-vision",
    appDir: APP_DIR,
    projectRoot: PROJECT_ROOT,
    bibleDir: BIBLE_DIR,
    chapterFiles: files,
  });
}

/**
 * 2) /api/books
 * List available book codes with chapter counts.
 */
function apiBooks(res) {
  const idx = indexBooks();
  const items = Object.keys(idx)
    .sort()
    .map((code) => ({
      book: code,
      chapters: idx[code].chapters.length,
    }));
  sendJSON(res, 200, { ok: true, items });
}

/**
 * 3) /api/book/chapters?book=GEN
 * List chapter numbers for a book.
 */
function apiBookChapters(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const idx = indexBooks();
  const entry = idx[book];
  if (!entry) return sendJSON(res, 404, { ok: false, error: "book not found" });
  sendJSON(res, 200, { ok: true, book, chapters: entry.chapters });
}

/**
 * 4) /api/book/meta?book=GEN
 * Per-book stats: chapters, total verses, first/last chapter.
 */
function apiBookMeta(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const idx = indexBooks();
  const entry = idx[book];
  if (!entry) return sendJSON(res, 404, { ok: false, error: "book not found" });

  let totalVerses = 0;
  for (const f of entry.files) totalVerses += countVersesInFile(f);

  sendJSON(res, 200, {
    ok: true,
    book,
    chapters: entry.chapters.length,
    totalVerses,
  });
}

/**
 * 5) /api/chapter?book=GEN&chapter=1
 * Full chapter payload with verses.
 */
function apiChapter(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const chap = Number(q.chapter);
  if (!book || !Number.isInteger(chap) || chap <= 0) {
    return sendJSON(res, 400, {
      ok: false,
      error: "book and positive integer chapter are required",
    });
  }
  const chapStr = String(chap).padStart(2, "0");
  const files = listChapterFiles().filter(
    (f) => f.includes("_" + book + "_") && f.endsWith("_" + chapStr + ".txt")
  );
  if (!files.length) return sendJSON(res, 404, { ok: false, error: "chapter not found" });

  const parsed = parseChapterFile(files[0]);
  if (!parsed) return sendJSON(res, 500, { ok: false, error: "parse failure" });

  sendJSON(res, 200, {
    ok: true,
    book: parsed.book,
    chapter: parsed.chapter,
    verses: parsed.verses,
    sourceFile: parsed.sourceFile,
  });
}

/**
 * 6) /api/chapter/verses?book=GEN&chapter=1
 * Verse metadata only (numbers and lengths).
 */
function apiChapterVerses(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const chap = Number(q.chapter);
  if (!book || !Number.isInteger(chap) || chap <= 0) {
    return sendJSON(res, 400, {
      ok: false,
      error: "book and positive integer chapter are required",
    });
  }
  const chapStr = String(chap).padStart(2, "0");
  console.log(book);
  console.log(chapStr);
  const files = listChapterFiles().filter(
    (f) => f.includes("_" + book + "_") && f.endsWith("_" + chapStr + ".txt")
  );
  console.log(files);
  if (!files.length) return sendJSON(res, 404, { ok: false, error: "chapter not found" });

  const parsed = parseChapterFile(files[0]);
  console.log(parsed);
  if (!parsed) return sendJSON(res, 500, { ok: false, error: "parse failure" });

  const verses = parsed.verses.map((v) => ({
    verse: v,
    words: v.trim().split(/\s+/).length,
    chars: v.length,
  }));
  sendJSON(res, 200, {
    ok: true,
    book: parsed.book,
    chapter: parsed.chapter,
    verseCount: parsed.verses.length,
    verses,
    sourceFile: parsed.sourceFile,
  });
}

/**
 * 7) /api/verse/random?seed=&book=GEN&chapter=1
 * Random verse globally, or limited to a book or chapter. Deterministic with seed.
 */
function apiVerseRandom(res, q) {
  if (!isDir(BIBLE_DIR))
    return sendJSON(res, 500, { ok: false, error: "world_english_bible not found" });

  const filesAll = listChapterFiles();
  if (!filesAll.length) return sendJSON(res, 500, { ok: false, error: "no chapter files found" });

  const book = q.book ? String(q.book).toUpperCase() : null;
  const chap = q.chapter ? String(Number(q.chapter)).padStart(2, "0") : null;

  let candidates = filesAll;
  if (book) candidates = candidates.filter((f) => f.includes("_" + book + "_"));
  if (book && chap) candidates = candidates.filter((f) => f.endsWith("_" + chap + ".txt"));
  if (!candidates.length) candidates = filesAll;

  const seed = q.seed ? String(q.seed) : null;

  const { _index, item: file } = pickRandom(candidates);
  const parsed = file && parseChapterFile(file);
  console.log(parsed);
  console.log("-------- ^^ parsed ----------");
  if (!parsed || !parsed.verses.length)
    return sendJSON(res, 500, { ok: false, error: "parse failure", file });

  // Use a different seed for verse selection
  const verseSeed = seed
    ? seed + "|" + parsed.book + "|" + parsed.chapter + "|" + parsed.sourceFile
    : null;
  const { index, item: verse } = pickRandom(parsed.verses);

  sendJSON(res, 200, {
    ok: true,
    book: parsed.book,
    chapter: parsed.chapter,
    verse: index,
    text: verse,
    sourceFile: parsed.sourceFile,
  });
}

function logLine(ts, method, pathWithQs, status, ms, bytes) {
  const size = bytes != null ? " " + bytes + "b" : "";
  console.log(ts + " " + method + " " + pathWithQs + " -> " + status + " " + ms + "ms" + size);
}

/**
 * 8) /api/search?q=light&book=GEN&limit=25
 * Very simple case-insensitive substring search over chapter files.
 * Returns verse-level hits, newest limited by limit.
 */
function apiSearch(res, q) {
  console.log("A");
  const term = (q.q || "").toString().trim();
  console.log("got the term: ", term);
  if (!term || term.length < 2)
    return sendJSON(res, 400, { ok: false, error: "q must be at least 2 characters" });

  const book = q.book ? String(q.book).toUpperCase() : null;
  const limit = Number(q.limit || 25);

  let files = listChapterFiles();
  if (book) files = files.filter((f) => f.includes("_" + book + "_"));

  const needle = term.toLowerCase();
  const hits = [];

  for (const f of files) {
    const parsed = parseChapterFile(f);
    if (!parsed) continue;
    for (const [idx, ver] of parsed.verses.entries()) {
      if (ver.toLowerCase().indexOf(needle) !== -1) {
        hits.push({
          book: parsed.book,
          chapter: parsed.chapter,
          verse: idx + 1,
          text: ver,
          sourceFile: parsed.sourceFile,
        });
        if (Number.isInteger(limit) && limit > 0 && hits.length >= limit) break;
      }
    }
    if (Number.isInteger(limit) && limit > 0 && hits.length >= limit) break;
  }

  sendJSON(res, 200, { ok: true, q: term, count: hits.length, items: hits });
}

/**
 * 9) /api/files
 * Raw file listing with sizes.
 */
function apiFiles(res) {
  try {
    const names = listChapterFiles();
    const items = names.map((f) => {
      const st = fs.statSync(path.join(BIBLE_DIR, f));
      return { file: f, bytes: st.size };
    });
    sendJSON(res, 200, { ok: true, dir: BIBLE_DIR, items, count: items.length });
  } catch {
    sendJSON(res, 500, { ok: false, error: "failed to stat files" });
  }
}

/**
 * 10) /api/stats
 * Global counts: books, chapters, verses.
 */
function apiStats(res) {
  const idx = indexBooks();
  const books = Object.keys(idx).length;

  let chapters = 0;
  let verses = 0;
  for (const b in idx) {
    chapters += idx[b].chapters.length;
    for (const f of idx[b].files) verses += countVersesInFile(f);
  }
  sendJSON(res, 200, { ok: true, books, chapters, verses });
}

/**
 * 11) /api/range?book=GEN&from=1&to=3
 * Chapters range summary for a book.
 */
function apiRange(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const from = Number(q.from);
  const to = Number(q.to);
  if (!book || !Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to < from) {
    return sendJSON(res, 400, {
      ok: false,
      error: "book, from, to must be positive integers (to >= from)",
    });
  }

  const out = [];
  for (let ch = from; ch <= to; ch++) {
    const chapStr = String(ch).padStart(2, "0");
    const files = listChapterFiles().filter(
      (f) => f.includes("_" + book + "_") && f.endsWith("_" + chapStr + ".txt")
    );
    if (!files.length) continue;
    const parsed = parseChapterFile(files[0]);
    if (!parsed) continue;
    out.push({
      book: parsed.book,
      chapter: parsed.chapter,
      verseCount: parsed.verses.length,
      preview: parsed.verses[0] ? parsed.verses[0].slice(0, 90) : "",
      sourceFile: parsed.sourceFile,
    });
  }

  if (!out.length) return sendJSON(res, 404, { ok: false, error: "no chapters in range" });
  sendJSON(res, 200, { ok: true, book, from, to, chapters: out });
}

/**
 * /api/verse?book=GEN&chapter=1&verse=3
 * Returns a single verse, or a helpful error.
 */
function apiVerse(res, q) {
  const book = q.book ? String(q.book).toUpperCase() : "";
  const chapter = Number(q.chapter);
  const verse = Number(q.verse);

  // Basic validation
  if (
    !book ||
    !Number.isInteger(chapter) ||
    chapter <= 0 ||
    !Number.isInteger(verse) ||
    verse <= 0
  ) {
    return sendJSON(res, 400, {
      ok: false,
      error: "book, chapter, verse are required (positive integers for chapter and verse)",
      example: "/api/verse?book=GEN&chapter=1&verse=3",
    });
  }

  // Find chapter file
  const chapStr = String(chapter).padStart(2, "0");
  const files = listChapterFiles().filter(
    (f) => f.includes("_" + book + "_") && f.endsWith("_" + chapStr + ".txt")
  );

  if (!files.length) {
    // If book exists, show available chapters to help the student
    const idx = indexBooks();
    if (!idx[book]) {
      return sendJSON(res, 404, { ok: false, error: "book not found", book });
    }
    return sendJSON(res, 404, {
      ok: false,
      error: "chapter not found for book",
      book,
      requestedChapter: chapter,
      availableChapters: idx[book].chapters,
    });
  }

  const parsed = parseChapterFile(files[0]);
  if (!parsed) return sendJSON(res, 500, { ok: false, error: "parse failure", file: files[0] });

  const maxVerse = parsed.verses.length;
  if (verse > maxVerse) {
    return sendJSON(res, 404, {
      ok: false,
      error: "verse not found in chapter",
      book: parsed.book,
      chapter: parsed.chapter,
      requestedVerse: verse,
      maxVerse,
    });
  }

  const text = parsed.verses[verse - 1]; // verses are 1-indexed for users

  return sendJSON(res, 200, {
    ok: true,
    book: parsed.book,
    chapter: parsed.chapter,
    verse,
    text,
    sourceFile: parsed.sourceFile,
  });
}

/* ============================== HTTP router ============================= */

const server = http.createServer((req, res) => {
  try {
    const u = url.parse(req.url, true);
    const p = u.pathname || "/";
    const start = Date.now();

    // NEW: wrap res.end to count bytes
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

    // NEW: log when response finishes (works for API + static)
    res.on("finish", () => {
      const ms = Date.now() - start;
      const ts = new Date().toISOString();
      const pathWithQs = u.pathname + (u.search || "");
      logLine(ts, req.method, pathWithQs, res.statusCode, ms, bytesSent);
    });

    // JSON API
    if (p === "/api/health") return apiHealth(res);
    if (p === "/api/books") return apiBooks(res);
    if (p === "/api/book/chapters") return apiBookChapters(res, u.query);
    if (p === "/api/book/meta") return apiBookMeta(res, u.query);
    if (p === "/api/chapter") return apiChapter(res, u.query);
    if (p === "/api/chapter/verses") return apiChapterVerses(res, u.query);
    if (p === "/api/verse/random") return apiVerseRandom(res, u.query);
    if (p === "/api/search") return apiSearch(res, u.query);
    if (p === "/api/files") return apiFiles(res);
    if (p === "/api/stats") return apiStats(res);
    if (p === "/api/range") return apiRange(res, u.query);
    if (p === "/api/locate") return apiLocate(res, u.query);
    if (p === "/api/verse") return apiVerse(res, u.query);

    // Static for index.html, logic.js, style.css
    return serveStatic(res, p);
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
});

/* ================================ start ================================= */

server.listen(PORT, () => {
  console.log("bible-vision listening on http://127.0.0.1:" + PORT + "/");
  console.log("project root: " + PROJECT_ROOT);
  console.log("bible dir   : " + BIBLE_DIR);
});
