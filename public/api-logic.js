// public/logic.js
(function () {
  "use strict";

  // --------------- DOM helpers ---------------
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
      if (
        Object.prototype.hasOwnProperty.call(params, k) &&
        params[k] !== undefined &&
        params[k] !== null &&
        params[k] !== ""
      ) {
        usp.append(k, String(params[k]));
      }
    }
    var s = usp.toString();
    return s ? "?" + s : "";
  }

  function formatRef(book, ch, v) {
    return book + " " + ch + ":" + v;
  }
  function showVersePayload(payload) {
    // Accept either your {ok:true, book, chapter, verse, text,...}
    // or any future shape; fallback to generic show().
    if (payload && payload.ok && payload.text && payload.book && payload.chapter && payload.verse) {
      out.textContent =
        formatRef(payload.book, payload.chapter, payload.verse) + "\n\n" + payload.text;
      // Optional: remember last verse for favorites
      window.lastVerse = {
        book: payload.book,
        chapter: payload.chapter,
        verse: payload.verse,
        text: payload.text,
      };
    } else {
      show(payload);
    }
  }

  // --------------- synchronous XHR ---------------
  function xhrJSON(method, url) {
    var xhr = new XMLHttpRequest();
    try {
      // Third arg "false" makes it synchronous
      xhr.open(method, url, false);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(null);
    } catch (e) {
      return { ok: false, status: 0, error: "Network error: " + String(e) };
    }

    var status = xhr.status;
    var text = xhr.responseText || "";

    // Try to parse JSON even on non-2xx because server sends JSON errors too
    try {
      var data = JSON.parse(text);
      if (typeof data === "object" && data && !("status" in data)) {
        data.status = status;
      }
      return data;
    } catch (e) {
      // Not JSON or invalid JSON
      return { ok: false, status: status, error: "Invalid JSON", raw: text };
    }
  }

  // --------------- read inputs ---------------
  function currentBook() {
    return el("bookSel").value || "";
  }
  function currentChapter() {
    return Number(el("chapterInp").value || 0);
  }
  function currentVerse() {
    return Number(el("verseInp").value || 0);
  }
  function currentQ() {
    return el("qInp").value.trim();
  }
  function currentLimit() {
    return Number(el("limitInp").value || 25);
  }
  function currentFrom() {
    return Number(el("fromInp").value || 0);
  }
  function currentTo() {
    return Number(el("toInp").value || 0);
  }

  // --------------- wire buttons ---------------
  el("btnHealth").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/health");
    show(data);
  });

  el("btnBooks").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/books");
    show(data);
  });

  el("btnFiles").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/files");
    show(data);
  });

  el("btnStats").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/stats");
    show(data);
  });

  el("btnBookChapters").addEventListener("click", function () {
    var book = currentBook();
    if (!book) return show({ ok: false, error: "Select a book in the dropdown." });
    var data = xhrJSON("GET", "/api/book/chapters" + toQuery({ book: book }));
    show(data);
  });

  el("btnBookMeta").addEventListener("click", function () {
    var book = currentBook();
    if (!book) return show({ ok: false, error: "Select a book in the dropdown." });
    var data = xhrJSON("GET", "/api/book/meta" + toQuery({ book: book }));
    show(data);
  });

  el("btnChapter").addEventListener("click", function () {
    var book = currentBook();
    var ch = currentChapter();
    if (!book || !ch) return show({ ok: false, error: "Select a book and enter a chapter." });
    var data = xhrJSON("GET", "/api/chapter" + toQuery({ book: book, chapter: ch }));
    show(data);
  });

  el("btnChapterVerses").addEventListener("click", function () {
    var book = currentBook();
    var ch = currentChapter();
    if (!book || !ch) return show({ ok: false, error: "Select a book and enter a chapter." });
    var data = xhrJSON("GET", "/api/chapter/verses" + toQuery({ book: book, chapter: ch }));
    show(data);
  });

  el("btnRange").addEventListener("click", function () {
    var book = currentBook();
    var from = currentFrom();
    var to = currentTo();
    if (!book || !from || !to)
      return show({ ok: false, error: "Select a book and enter from/to." });
    var data = xhrJSON("GET", "/api/range" + toQuery({ book: book, from: from, to: to }));
    show(data);
  });

  el("btnRandom").addEventListener("click", function () {
    var params = {};
    var book = currentBook();
    var ch = currentChapter();
    if (book) params.book = book;
    if (ch) params.chapter = ch;
    var data = xhrJSON("GET", "/api/verse/random" + toQuery(params));
    show(data);
  });

  el("loadFromBook").addEventListener("click", function () {
    var book = currentLoadFromBook();
    // var
  });

  el("btnVerse").addEventListener("click", function () {
    var book = currentBook();
    var ch = currentChapter();
    var v = currentVerse();

    if (!book || !ch || !v) {
      return show({
        ok: false,
        error: "Provide book, chapter, and verse.",
        example: "/api/verse?book=GEN&chapter=1&verse=3",
      });
    }

    var qs = toQuery({ book: book, chapter: ch, verse: v });
    var data = xhrJSON("GET", "/api/verse" + qs);
    // data.status is attached by xhrJSON
    if (!data || data.ok === false) return show(data);
    showVersePayload(data);
  });

  el("btnSearch").addEventListener("click", function () {
    var q = currentQ();
    if (!q || q.length < 2) return show({ ok: false, error: "Enter at least 2 characters for q." });
    var params = { q: q };
    var book = currentBook();
    var limit = currentLimit();
    if (book) params.book = book;
    if (limit) params.limit = limit;
    var data = xhrJSON("GET", "/api/search" + toQuery(params));
    show(data);
  });

  // --------------- populate book select ---------------
  function populateBooks(items) {
    function fill(id) {
      var sel = el(id);
      sel.innerHTML = '<option value="">(none)</option>';
      if (!items || !items.length) return;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var opt = document.createElement("option");
        opt.value = it.book;
        opt.textContent = it.book + " (" + it.chapters + ")";
        sel.appendChild(opt);
      }
    }
    fill("bookSel");
    fill("loadFromBook");
  }

  // --------------- boot (synchronous) ---------------
  function boot() {
    var h = xhrJSON("GET", "/api/health");
    show(h);

    var b = xhrJSON("GET", "/api/books");
    if (b && b.ok && Array.isArray(b.items)) {
      populateBooks(b.items);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
