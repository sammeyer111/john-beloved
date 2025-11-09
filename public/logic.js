(function () {
  "use strict";

  // --------------- DOM helpers ---------------
  function el(id) {
    return document.getElementById(id);
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

  const todo_list = el("taskList");

  function markAllComplete() {
    for (const node of todo_list.childNodes) {
      node.querySelector("input").checked = true;
      console.log(
        xhrJSON("GET", `/api/item/update?id=${node.id.replace("list_item_", "")}&done=true`)
      );
    }
  }

  const markAllBtn = el("markAllBtn");
  markAllBtn.addEventListener("click", markAllComplete);

  var health = xhrJSON("GET", "/api/health");
  var list_data = xhrJSON("GET", "/api/list");

  var item_list = list_data["items"];
  for (let i = 0; i < item_list.length; i++) {
    let item = item_list[i];
    const list_item = document.createElement("li");
    const check = document.createElement("input");
    check.type = "checkbox";
    list_item.id = "list_item_" + item["id"];
    list_item.textContent = item["text"];
    list_item.prepend(check);
    todo_list.appendChild(list_item);
  }
})();
