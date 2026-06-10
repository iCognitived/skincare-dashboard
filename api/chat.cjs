module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { system, messages } = req.body;

    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + process.env.GEMINI_API_KEY;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      }),
    });

    const data = await response.json();
    console.log("status:", response.status);
    console.log("data:", JSON.stringify(data).slice(0, 300));

    if (!response.ok) {
      return res.status(500).json({ error: data.error ? data.error.message : "API error" });
    }

    const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : null;

    if (!text) {
      return res.status(500).json({ error: "No text in response" });
    }

    return res.status(200).json({ text: text });
  } catch (err) {
    console.log("catch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
