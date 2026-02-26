function resolveProvider() {
  const preferred = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (preferred === "gemini" && hasGemini) return "gemini";
  if (preferred === "openai" && hasOpenAI) return "openai";
  if (hasGemini) return "gemini";
  if (hasOpenAI) return "openai";
  return "none";
}

export default async function handler(req, res) {
  const provider = resolveProvider();
  const model = provider === "gemini" ? process.env.GEMINI_MODEL || "gemini-2.0-flash" : process.env.OPENAI_MODEL || "gpt-4o-mini";

  return res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    provider,
    providerConfigured: provider !== "none",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model,
    maxMessageLength: 3000,
    maxHistoryItems: 10
  });
}
