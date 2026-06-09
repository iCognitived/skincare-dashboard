// api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, messages } = req.body;
console.log("Key present:", !!process.env.GEMINI_API_KEY);
console.log("Key starts with:", process.env.GEMINI_API_KEY?.slice(0, 6));
  const contents = [];
  for (const msg of messages) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    console.log("Gemini status:", response.status);
    console.log("Gemini response:", JSON.stringify(data).slice(0, 500));

    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message || "Gemini API error" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.log("No text in response:", JSON.stringify(data));
      return res.status(500).json({ error: "No text returned from Gemini" });
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({ error: err.message });
  }
}
