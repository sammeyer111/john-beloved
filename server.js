const express = require("express");
const path = require("path");
const app = express();
const PORT = 4004;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Example API route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// Fallback for all other routes (Express 5 safe)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// function apiRandomVerse(res, query){
//   if (!fstat.existsSync(BIBLE_DIR)){
//     return sendJson(res, 500, {
//       ok: false,
//       error: "world_english_bible directory not found",
//       bibleDir: BIBLE_DIR
//     });
//   const files = listChapterFiles();
//   if (!files.length){
//     return sendJson(res, 500, {
//       ok: false,
//       error: "no chapter files found in world_english_bible",
//     });
//   }
//   }
// }
