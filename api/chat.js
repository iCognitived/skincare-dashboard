module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { system, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid messages array." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set." });
    }

    const contents = messages.slice(-12).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content || "" }],
    }));

    // Try gemini-2.5-flash first, fall back to gemini-2.0-flash if needed
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    };

    if (system && system.trim() !== "") {
      requestBody.systemInstruction = {
        parts: [{ text: system }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log("Gemini status:", response.status);
    console.log("Gemini model:", model);

    if (!response.ok) {
      console.error("Gemini error body:", JSON.stringify(data));
      const errMsg = data?.error?.message || "Gemini API error";
      // Surface the actual Gemini error to help debug
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("No text in Gemini response:", JSON.stringify(data));
      // Check for safety blocks
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") {
        return res.status(200).json({ text: "I can't respond to that one — try rephrasing your question." });
      }
      return res.status(500).json({ error: "No text returned from Gemini. Finish reason: " + (finishReason || "unknown") });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
