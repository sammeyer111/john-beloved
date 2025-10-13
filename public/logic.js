document.addEventListener("DOMContentLoaded", async () => {
  const taskInput = document.getElementById("taskInput");
  const addBtn = document.getElementById("addBtn");
  const taskList = document.getElementById("taskList");
  const clearBtn = document.getElementById("clearBtn");
  const markAllBtn = document.getElementById("markAllBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const taskCount = document.getElementById("taskCount");

  let tasks = [];

  // Load initial data from /data/todo.json
  try {
    const res = await fetch("../data/todo.json");
    if (res.ok) tasks = await res.json();
  } catch (err) {
    console.error("Could not load todo.json:", err);
  }

  render();

  // ===== Event Handlers =====
  addBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", (e) => e.key === "Enter" && addTask());
  clearBtn.addEventListener("click", clearCompleted);
  markAllBtn.addEventListener("click", markAllComplete);
  clearAllBtn.addEventListener("click", clearAll);

  // ===== Functions =====
  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now(), text, completed: false });
    taskInput.value = "";
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      render();
    }
  }

  function clearCompleted() {
    tasks = tasks.filter((t) => !t.completed);
    render();
  }

  function markAllComplete() {
    tasks.forEach((t) => (t.completed = true));
    render();
  }

  function clearAll() {
    tasks = [];
    render();
  }

  function render() {
    taskList.innerHTML = "";
    tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className =
        "flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition";
      li.innerHTML = `
        <div class="flex items-center space-x-2">
          <input type="checkbox" class="w-5 h-5 accent-indigo-600" ${t.completed ? "checked" : ""}>
          <span class="text-gray-800 ${t.completed ? "line-through text-gray-400" : ""}">
            ${t.text}
          </span>
        </div>
        <button class="text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
      `;

      const checkbox = li.querySelector("input");
      const deleteBtn = li.querySelector("button");

      checkbox.addEventListener("change", () => toggleTask(t.id));
      deleteBtn.addEventListener("click", () => {
        tasks = tasks.filter((task) => task.id !== t.id);
        render();
      });

      taskList.appendChild(li);
    });

    taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  }
});
