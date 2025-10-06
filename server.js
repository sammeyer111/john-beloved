const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data", "todos.json");

app.use(express.json());
app.use(express.static("public"));

// Load & Save helpers
function loadTodos() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading todos.json:", err);
    return [];
  }
}

function saveTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
}

let todos = loadTodos();

// API routes
app.get("/api/todos", (req, res) => res.json(todos));

app.post("/api/todos", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Todo text required" });
  const newTodo = { id: Date.now(), text, done: false };
  todos.push(newTodo);
  saveTodos(todos);
  res.status(201).json(newTodo);
});

app.put("/api/todos/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return res.status(404).json({ error: "Todo not found" });
  todo.done = !todo.done;
  saveTodos(todos);
  res.json(todo);
});

app.delete("/api/todos/:id", (req, res) => {
  const id = parseInt(req.params.id);
  todos = todos.filter((t) => t.id !== id);
  saveTodos(todos);
  res.json({ message: "Todo deleted" });
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
