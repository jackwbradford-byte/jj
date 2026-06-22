// Serverless chat backend for JJ
// Intended for Vercel (/api/chat) or any Node serverless runtime.

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const user = (body?.message ?? "").toString().slice(0, 2000).trim();
  if (!user) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing message" }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY" }));
    return;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          { role: "system", content: "You are JJ, a helpful AI assistant." },
          { role: "user", content: user },
        ],
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      const msg = json?.error?.message || "Backend call failed";
      res.statusCode = response.status;
      res.end(JSON.stringify({ error: msg }));
      return;
    }

    const reply = json.choices?.[0]?.message?.content?.trim();
    res.statusCode = 200;
    res.end(JSON.stringify({ reply: reply || "I’m not sure—could you rephrase?" }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "JJ backend crashed" }));
  }
}
