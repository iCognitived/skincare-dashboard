// api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, messages } = req.body;

  // Combine system prompt + messages into Gemini format
  const contents = [];

  // Add conversation history
  for (const msg of messages) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: data });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
  res.status(200).json({ text });
}
