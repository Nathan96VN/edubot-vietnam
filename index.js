const express = require("express");
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.post("/ask", async (req, res) => {
  const { question } = req.body;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: "You are EduBot, a friendly AI tutor for Vietnamese students grades 1-12. Always explain step by step. If the student writes in Vietnamese, reply in both Vietnamese and English. Be encouraging and kind.",
      messages: [{ role: "user", content: question }]
    })
  });
  const data = await response.json();
  res.json({ answer: data.content[0].text });
});

app.listen(process.env.PORT || 3000);
