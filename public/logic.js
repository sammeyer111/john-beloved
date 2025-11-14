// public/logic.js
(function () {
  "use strict";

  // ---------- tiny DOM helpers ----------
  function el(id) {
    return document.getElementById(id);
  }
  var out = el("out");

  function show(obj) {
    try {
      out.textContent = JSON.stringify(obj, null, 2);
    } catch (e) {
      out.textContent = String(obj);
    }
  }

  function toQuery(params) {
    if (!params) return "";
    var usp = new URLSearchParams();
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) {
        var v = params[k];
        if (v !== undefined && v !== null && v !== "") usp.append(k, String(v));
      }
    }
    var s = usp.toString();
    return s ? "?" + s : "";
  }

  // ---------- synchronous XHR (no fetch, no promises) ----------
  function xhrJSON(method, url) {
    var xhr = new XMLHttpRequest();
    try {
      xhr.open(method, url, false); // synchronous
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(null);
    } catch (e) {
      return { ok: false, status: 0, error: "Network error: " + String(e) };
    }
    var status = xhr.status;
    var text = xhr.responseText || "";
    try {
      var data = JSON.parse(text);
      if (typeof data === "object" && data && !("status" in data)) data.status = status;
      return data;
    } catch (e) {
      return { ok: false, status: status, error: "Invalid JSON", raw: text };
    }
  }

  // ---------- current inputs ----------
  function currentBook() {
    return el("bookSel").value || "";
  }
  function currentChapter() {
    return Number(el("chapterInp").value || 0);
  }

    function currentBook2() {
    return el("loadFromBook").value || "";
  }
  function currentChapter2() {
    return Number(el("chapterInp").value || 0);
  }

  // ---------- example actions ----------
  function loadHealth() {
    show(xhrJSON("GET", "/api/health"));
  }

  function loadBooks() {
    var resp = xhrJSON("GET", "/api/books");
    show(resp);
    if (resp && resp.ok && Array.isArray(resp.items)) populateBooks(resp.items);
  }

  function randomVerse() {
    var book = currentBook();
    var ch = currentChapter();
    var params = {};
    if (book) params.book = book;
    if (ch) params.chapter = ch;
    var resp = xhrJSON("GET", "/api/verse/random" + toQuery(params));
    show(resp);
  }

  function loadVerse(){
    var book = currentBook2();
    var ch = currentChapter2();
    var params = {};
    if (book) params.book = book;
    if (ch) params.chapter = ch;
    var resp = xhrJSON("GET", "/api/verse?book=GEN&chapter=1&verse=3" + toQuery(params));
    show(resp);
  }

  // ---------- populate selects ----------
  function populateBooks(items) {
    var sel = el("bookSel");
    sel.innerHTML = '<option value="">(none)</option>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var opt = document.createElement("option");
      opt.value = it.book;
      opt.textContent = it.book + " (" + it.chapters + ")";
      sel.appendChild(opt);
    }
  }

  // ---------- wire UI ----------
  function wire() {
    el("btnRandom").addEventListener("click", randomVerse);

    function wire() {
    el("btnVerse").addEventListener("click", loadVerse);
    // TODO students:
    // - Add buttons/inputs and hook them to:
    //   - /api/chapter?book=CODE&chapter=N
    //   - /api/chapter/verses?book=CODE&chapter=N
    //   - /api/search?q=term&book=CODE&limit=25
    //   - /api/range?book=CODE&from=A&to=B
    //   - /api/files, /api/stats, /api/book/meta, /api/book/chapters
  }

  // ---------- boot ----------
  function boot() {
    loadHealth(); // show something on first load
    loadBooks(); // populate book select
    wire();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
