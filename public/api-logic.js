// public/api-logic.js
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

  // --------------- synchronous XHR ---------------
  function xhrJSON(method, url) {
    var xhr = new XMLHttpRequest();
    try {
      // Third arg false => synchronous
      xhr.open(method, url, false);
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

  // toQuery(params)
  // Build a URL query string from a plain object, safely.
  // Returns "" if there are no usable params, otherwise returns something like "?a=1&b=two".
  //
  // Rules:
  // - Ignores keys from the prototype chain (uses hasOwnProperty).
  // - Skips values that are undefined, null, or "" (empty string).
  // - Coerces all remaining values to strings.
  // - Uses URLSearchParams to handle encoding (spaces, special characters).
  //
  // Examples:
  //   toQuery({})                           -> ""
  //   toQuery({ q: "milk", done: false })   -> "?q=milk&done=false"
  //   toQuery({ page: 0, limit: 25 })       -> "?page=0&limit=25"
  //   toQuery({ a: undefined, b: null })    -> ""
  //
  // Notes:
  // - Using URLSearchParams avoids manual encoding bugs.
  // - Returning "" makes it easy to do: "/api/list" + toQuery(opts).
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

  // --------------- read inputs ---------------
  function currentId() {
    return Number(el("idInp").value || 0);
  }
  function currentText() {
    return el("textInp").value || "";
  }
  function currentDone() {
    return !!el("doneChk").checked;
  }
  function currentQ() {
    return el("qInp").value.trim();
  }

  // --------------- optional rendering helpers ---------------
  function renderListPayload(payload) {
    return show(payload);
    // if (!payload || !payload.ok || !Array.isArray(payload.items)) return show(payload);
    // // Compact readable list
    // var lines = payload.items.map(function (it) {
    //   var mark = it.done ? "[x]" : "[ ]";
    //   return mark + " #" + it.id + "  " + it.text;
    // });
    // out.textContent = "Items: " + payload.items.length + "\n" + lines.join("\n");
  }

  // --------------- wire buttons ---------------
  el("btnHealth").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/health");
    show(data);
  });

  el("btnStats").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/stats");
    show(data);
  });

  el("btnListAll").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/list");
    renderListPayload(data);
  });

  el("btnListOpen").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/list" + toQuery({ done: "false" }));
    renderListPayload(data);
  });

  el("btnListDone").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/list" + toQuery({ done: "true" }));
    renderListPayload(data);
  });

  el("btnListQuery").addEventListener("click", function () {
    var q = currentQ();
    if (!q || q.length < 1) return show({ ok: false, error: "Enter a query in Filter q." });
    var data = xhrJSON("GET", "/api/list" + toQuery({ q: q }));
    renderListPayload(data);
  });

  el("btnGet").addEventListener("click", function () {
    var id = currentId();
    if (!id) return show({ ok: false, error: "Enter an id." });
    var data = xhrJSON("GET", "/api/item/get" + toQuery({ id: id }));
    show(data);
  });

  el("btnAdd").addEventListener("click", function () {
    var text = currentText().trim();
    var done = currentDone();
    if (!text) return show({ ok: false, error: "Enter text to add." });
    var data = xhrJSON("GET", "/api/item/add" + toQuery({ text: text, done: done }));
    show(data);
  });

  el("btnUpdate").addEventListener("click", function () {
    var id = currentId();
    var params = { id: id };
    if (!id) return show({ ok: false, error: "Enter an id." });

    // Optional updates: include only if present
    var text = currentText();
    var hasText = text.trim().length > 0;
    var doneFlag = currentDone();
    var includeDone = el("doneChk").checked === true || el("doneChk").checked === false; // always true; kept for symmetry

    if (!hasText && typeof doneFlag !== "boolean") {
      return show({ ok: false, error: "Provide text and/or done to update." });
    }
    if (hasText) params.text = text;
    if (typeof doneFlag === "boolean") params.done = doneFlag;

    var data = xhrJSON("GET", "/api/item/update" + toQuery(params));
    show(data);
  });

  el("btnToggle").addEventListener("click", function () {
    var id = currentId();
    if (!id) return show({ ok: false, error: "Enter an id." });
    var data = xhrJSON("GET", "/api/item/toggle" + toQuery({ id: id }));
    show(data);
  });

  el("btnDelete").addEventListener("click", function () {
    var id = currentId();
    if (!id) return show({ ok: false, error: "Enter an id." });
    var data = xhrJSON("GET", "/api/item/delete" + toQuery({ id: id }));
    show(data);
  });

  el("btnClearCompleted").addEventListener("click", function () {
    var data = xhrJSON("GET", "/api/clear-completed");
    show(data);
  });

  // --------------- boot (synchronous) ---------------
  function boot() {
    var h = xhrJSON("GET", "/api/health");
    show(h);
    var list = xhrJSON("GET", "/api/list");
    renderListPayload(list);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
