const todoList = document.getElementById("todo-list");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const themeToggle = document.getElementById("theme-toggle");
const filterButtons = document.querySelectorAll(".filter-btn");

let todos = [];
let currentFilter = "all";

// --- Load Todos ---
async function loadTodos() {
  const res = await fetch("/api/todos");
  todos = await res.json();
  renderTodos();
}

// --- Render Todos ---
function renderTodos() {
  todoList.innerHTML = "";
  const filtered = todos.filter((todo) => {
    if (currentFilter === "active") return !todo.done;
    if (currentFilter === "done") return todo.done;
    return true;
  });

  filtered.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item";
    li.classList.toggle("done", todo.done);
    li.innerHTML = `
      <label>
        <input type="checkbox" ${todo.done ? "checked" : ""}>
        <span>${todo.text}</span>
      </label>
      <button class="delete-btn">×</button>
    `;

    // smooth fade-in animation
    li.style.animation = "fadeIn 0.3s ease";

    // toggle done
    li.querySelector("input").addEventListener("change", async () => {
      await fetch(`/api/todos/${todo.id}`, { method: "PUT" });
      loadTodos();
    });

    // delete
    li.querySelector(".delete-btn").addEventListener("click", async () => {
      li.style.animation = "fadeOut 0.3s ease forwards";
      setTimeout(async () => {
        await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
        loadTodos();
      }, 250);
    });

    todoList.appendChild(li);
  });
}

// --- Add Todo ---
todoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  todoInput.value = "";
  loadTodos();
});

// --- Theme Handling (with localStorage) ---
function applyTheme(savedTheme) {
  const isDark = savedTheme === "dark";
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "☀️" : "🌙";
}

themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
});

// Apply saved theme on load
const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

// --- Filter Buttons ---
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTodos();
  });
});

// Init
loadTodos();
