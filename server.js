"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 4004;
const ROOT = path.join(__dirname, "public");

// MIME types by extension
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ico": "image/x-icon",
};

// Only serve these four files
const ALLOWED = new Set(["/favicon.ico", "/index.html", "/style.css", "/logic.js"]);

function sendFile(res, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  try {
    const data = fs.readFileSync(filepath);
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  let pathname = url.pathname;

  if (pathname === "/") pathname = "/index.html";
  if (!ALLOWED.has(pathname)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }

  const filepath = path.join(ROOT, pathname.slice(1)); // slice(1) drops leading slash
  sendFile(res, filepath);
});

server.listen(PORT, () => {
  console.log("Server listening on http://localhost:" + PORT);
});
