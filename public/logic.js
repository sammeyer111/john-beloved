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

  function addTask(name, done = false) {
    if (name.trim()) {
      const encodedName = encodeURIComponent(name).replace(/%20/g, "+");
      const response = xhrJSON("GET", `/api/item/add?text=${encodedName}&done=${done}`);
      if (response["status"] === 200 && response["ok"] === true) {
        displayTask(response["item"]["id"], name, done);
      }
    }
    return false;
  }

  const addBtn = el("addBtn");
  const input = el("taskInput");
  addBtn.addEventListener("click", function () {
    addTask(input.value);
    input.value = "";
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addBtn.click();
    }
  });

  function displayTask(id, name, done) {
    const list_item = document.createElement("li");
    const check = document.createElement("input");
    check.type = "checkbox";
    if (done) check.checked = true;
    check.addEventListener("change", function (event) {
      xhrJSON("GET", `/api/item/update?id=${id}&done=${event.target.checked}`);
    });
    list_item.id = "list_item_" + id;
    list_item.textContent = name;
    list_item.prepend(check);
    todo_list.appendChild(list_item);
  }

  function markAllComplete() {
    const items = Array.from(todo_list.children);
    for (const node of items) {
      node.querySelector("input").checked = true;
      xhrJSON("GET", `/api/item/update?id=${node.id.replace("list_item_", "")}&done=true`);
    }
  }

  const markAllBtn = el("markAllBtn");
  markAllBtn.addEventListener("click", markAllComplete);

  function clearCompleted() {
    const items = Array.from(todo_list.children);
    for (const node of items) {
      if (node.querySelector("input").checked) {
        xhrJSON("GET", `/api/item/delete?id=${node.id.replace("list_item_", "")}`);
        node.remove();
      }
    }
  }

  const clearBtn = el("clearBtn");
  clearBtn.addEventListener("click", clearCompleted);

  const taskCount = el("taskCount");
  todo_list.addEventListener("change", function (event) {
    const text = `${todo_list.children.length} tasks`;
    taskCount.textContent = text;
  });

  function deleteAll() {
    const items = Array.from(todo_list.children);
    for (const node of items) {
      xhrJSON("GET", `/api/item/delete?id=${node.id.replace("list_item_", "")}`);
      node.remove();
    }
  }

  const clearAllBtn = el("clearAllBtn");
  clearAllBtn.addEventListener("click", deleteAll);

  var list_data = xhrJSON("GET", "/api/list");

  var item_list = list_data["items"];
  for (let i = 0; i < item_list.length; i++) {
    let item = item_list[i];
    displayTask(item["id"], item["text"], item["done"]);
  }
})();
