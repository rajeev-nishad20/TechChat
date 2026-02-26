import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const MAX_MESSAGE_LENGTH = 3000;
const MAX_HISTORY_ITEMS = 10;

function sanitizeText(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === "model" ? "model" : "user",
      text: sanitizeText(item?.text || "")
    }))
    .filter((item) => item.text.length > 0);
}

function buildFallbackReply(message, provider = "gemini") {
  const normalized = sanitizeText(message).toLowerCase();
  const providerLabel = provider === "openai" ? "OpenAI" : "Gemini";

  if (/error|exception|bug|fail|stack|crash/.test(normalized)) {
    return `${providerLabel} is unavailable. Debug checklist:\n1) Reproduce with minimal input\n2) Inspect first user-code stack frame\n3) Add logs at input/output boundaries\n4) Validate null/undefined and async branches\n5) Apply one fix at a time`;
  }

  return `${providerLabel} is currently unavailable because the configured key appears invalid or exhausted. Please update your API key and retry.`;
}

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
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const provider = resolveProvider();
  const message = sanitizeText(req.body?.message);
  const history = normalizeHistory(req.body?.history);

  if (!message) {
    return res.status(400).json({ success: false, error: "Message is required." });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, error: `Message too long. Max ${MAX_MESSAGE_LENGTH}.` });
  }

  const startedAt = Date.now();

  try {
    if (provider === "gemini") {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = client.getGenerativeModel({ model: modelName });

      const combinedPrompt = [
        "You are TechChat, a helpful coding assistant.",
        history.length
          ? `Recent chat context:\n${history
              .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`)
              .join("\n")}`
          : "",
        `User: ${message}`,
        "Assistant:"
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await model.generateContent(combinedPrompt);
      const response = await result.response;
      const reply = sanitizeText(response.text());

      if (!reply) throw new Error("empty_response");

      return res.status(200).json({
        success: true,
        reply,
        model: modelName,
        provider,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt
      });
    }

    if (provider === "openai") {
      const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await client.chat.completions.create({
        model: modelName,
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          { role: "system", content: "You are TechChat, a helpful coding assistant." },
          ...history.map((item) => ({
            role: item.role === "user" ? "user" : "assistant",
            content: item.text
          })),
          { role: "user", content: message }
        ]
      });

      const reply = sanitizeText(completion.choices?.[0]?.message?.content || "");
      if (!reply) throw new Error("empty_response");

      return res.status(200).json({
        success: true,
        reply,
        model: modelName,
        provider,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt
      });
    }

    return res.status(200).json({
      success: true,
      fallback: true,
      fallbackReason: "missing_key",
      reply: buildFallbackReply(message),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    const statusCode = msg.includes("quota") || msg.includes("resource_exhausted") ? 429 : 200;
    return res.status(statusCode === 429 ? 200 : 200).json({
      success: true,
      fallback: true,
      fallbackReason: statusCode === 429 ? "quota_exceeded" : "provider_unavailable",
      reply: buildFallbackReply(message, provider),
      details: process.env.NODE_ENV === "development" ? String(error?.message || "") : undefined,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt
    });
  }
}
