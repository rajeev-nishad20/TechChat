import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { networkInterfaces } from "os";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || "development";
const AI_PROVIDER = (process.env.AI_PROVIDER || "").toLowerCase();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const MAX_MESSAGE_LENGTH = 3000;
const MAX_HISTORY_ITEMS = 10;
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP = 45;
const providerDisabledState = {
    openai: false,
    gemini: false
};

const rateLimitStore = new Map();

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + REQUEST_WINDOW_MS };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + REQUEST_WINDOW_MS;
    }

    entry.count += 1;
    rateLimitStore.set(ip, entry);

    if (entry.count > MAX_REQUESTS_PER_IP) {
        return res.status(429).json({
            success: false,
            error: "Too many requests. Please wait a minute and try again.",
            retryAfterMs: entry.resetAt - now
        });
    }

    return next();
});

const frontendPath = path.join(__dirname, "../frontend");
const frontendDistPath = path.join(frontendPath, "dist");
const staticRoot = fs.existsSync(frontendDistPath) ? frontendDistPath : frontendPath;

app.use(
    express.static(staticRoot, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith(".html")) {
                res.set("Cache-Control", "no-cache");
            }
        }
    })
);

const hasGemini = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0);
const hasOpenAI = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0);

const availableProviders = {
    gemini: hasGemini,
    openai: hasOpenAI
};

function resolveProvider() {
    if (AI_PROVIDER && availableProviders[AI_PROVIDER]) {
        return AI_PROVIDER;
    }
    if (hasGemini) {
        return "gemini";
    }
    if (hasOpenAI) {
        return "openai";
    }
    return "none";
}

const activeProvider = resolveProvider();

const geminiClient = hasGemini ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = hasGemini
    ? geminiClient.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
              topP: 0.9,
              topK: 40
          }
      })
    : null;

const openai = hasOpenAI
    ? new OpenAI({
          apiKey: OPENAI_API_KEY
      })
    : null;

const systemInstruction = [
    "You are TechChat, a helpful coding assistant.",
    "Give concise, correct answers with practical examples when useful.",
    "If user asks for harmful or disallowed content, refuse politely and provide safe alternatives.",
    "Prefer step-by-step troubleshooting when user asks to fix bugs."
].join(" ");

function buildFallbackReply(message, reason = "provider_unavailable", provider = activeProvider) {
    const normalized = message.toLowerCase();
    const providerLabel = provider === "gemini" ? "Gemini" : "OpenAI";

    if (reason === "quota_exceeded") {
        return [
            `${providerLabel} request quota is currently exhausted for this API key.`,
            `Please enable billing/usage for your ${providerLabel} key, then restart the server.`,
            "Until then, fallback guidance mode will stay active."
        ].join("\n");
    }

    if (/error|exception|bug|fail|stack|crash/.test(normalized)) {
        return [
            `${providerLabel} is currently unavailable, so here is a debugging checklist:`,
            "1) Reproduce with smallest input.",
            "2) Read full stack trace and identify first user-code frame.",
            "3) Add targeted logs around inputs/outputs.",
            "4) Validate null/undefined and async error paths.",
            "5) Re-run after one fix at a time."
        ].join("\n");
    }

    if (/dsa|algorithm|leetcode|array|tree|graph/.test(normalized)) {
        return [
            `${providerLabel} is currently unavailable. Quick DSA approach template:`,
            "- Clarify constraints and edge cases.",
            "- Derive brute force and complexity.",
            "- Optimize with right data structure (hash map/heap/two pointers/DP).",
            "- Dry-run with a sample input.",
            "- Provide final complexity and trade-offs."
        ].join("\n");
    }

    return [
        `${providerLabel} is currently unavailable because the configured key appears invalid or exhausted.`,
        `Please generate a new API key and set ${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} in .env.`,
        "I can still help with structured guidance. Share your code/problem and I will break it down step by step."
    ].join("\n");
}

function isForbiddenProviderError(error) {
    const msg = String(error?.message || "").toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    return (
        status === 401 ||
        status === 403 ||
        msg.includes("forbidden") ||
        msg.includes("invalid api key") ||
        msg.includes("api key was reported as leaked")
    );
}

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(staticRoot, "index.html"));
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        port: PORT,
        provider: activeProvider,
        geminiConfigured: hasGemini,
        openaiConfigured: hasOpenAI,
        model: activeProvider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL,
        env: NODE_ENV
    });
});

app.get("/config", (req, res) => {
    const providerAvailable =
        activeProvider !== "none" &&
        availableProviders[activeProvider] &&
        !providerDisabledState[activeProvider];

    res.json({
        success: true,
        serverTime: new Date().toISOString(),
        provider: activeProvider,
        openaiConfigured: hasOpenAI,
        geminiConfigured: hasGemini,
        providerConfigured: providerAvailable,
        model: activeProvider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL,
        providerTemporarilyDisabled: activeProvider === "none" ? false : providerDisabledState[activeProvider],
        maxMessageLength: MAX_MESSAGE_LENGTH,
        maxHistoryItems: MAX_HISTORY_ITEMS
    });
});

function sanitizeText(value) {
    return String(value || "")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .trim();
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .slice(-MAX_HISTORY_ITEMS)
        .map((item) => ({
            role: item?.role === "model" ? "model" : "user",
            text: sanitizeText(item?.text || "")
        }))
        .filter((item) => item.text.length > 0);
}

app.post("/chat", async (req, res) => {
    const startedAt = Date.now();
    const currentProvider = activeProvider;

    try {
        const providerUnavailable =
            currentProvider === "none" ||
            !availableProviders[currentProvider] ||
            providerDisabledState[currentProvider];

        if (providerUnavailable) {
            return res.json({
                success: true,
                reply: buildFallbackReply(
                    req.body?.message,
                    currentProvider === "none" ? "missing_key" : "provider_unavailable",
                    currentProvider === "none" ? "gemini" : currentProvider
                ),
                timestamp: new Date().toISOString(),
                latencyMs: Date.now() - startedAt,
                usage: {
                    historyItemsUsed: 0,
                    inputChars: String(req.body?.message || "").length,
                    outputChars: 0
                },
                fallback: true,
                fallbackReason: currentProvider === "none" ? "missing_key" : "provider_unavailable"
            });
        }

        const message = sanitizeText(req.body?.message);
        const history = normalizeHistory(req.body?.history);

        if (!message) {
            return res.status(400).json({ success: false, error: "Message is required." });
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
            });
        }

        let reply = "";

        if (currentProvider === "gemini") {
            const combinedPrompt = [
                `System instruction: ${systemInstruction}`,
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

            const result = await geminiModel.generateContent(combinedPrompt);
            const response = await result.response;
            reply = sanitizeText(response.text());
        } else {
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                temperature: 0.7,
                max_tokens: 1200,
                messages: [
                    { role: "system", content: systemInstruction },
                    ...history.map((item) => ({
                        role: item.role === "user" ? "user" : "assistant",
                        content: item.text
                    })),
                    { role: "user", content: message }
                ]
            });

            reply = sanitizeText(completion.choices?.[0]?.message?.content || "");
        }

        if (!reply) {
            return res.status(502).json({
                success: false,
                error: "Model returned an empty response. Please retry."
            });
        }

        return res.json({
            success: true,
            reply,
            timestamp: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            usage: {
                historyItemsUsed: history.length,
                inputChars: message.length,
                outputChars: reply.length
            }
        });
    } catch (error) {
        if (isForbiddenProviderError(error)) {
            if (currentProvider !== "none") {
                providerDisabledState[currentProvider] = true;
            }
            console.error(`${currentProvider.toUpperCase()} key rejected. Falling back to local responses.`);
            return res.json({
                success: true,
                reply: buildFallbackReply(req.body?.message, "invalid_key", currentProvider),
                timestamp: new Date().toISOString(),
                latencyMs: Date.now() - startedAt,
                usage: {
                    historyItemsUsed: 0,
                    inputChars: String(req.body?.message || "").length,
                    outputChars: 0
                },
                fallback: true,
                fallbackReason: "invalid_key"
            });
        }

        const statusCode = String(error?.message || "").toLowerCase().includes("quota") ? 429 : 500;
        if (statusCode === 429) {
            return res.json({
                success: true,
                reply: buildFallbackReply(req.body?.message, "quota_exceeded", currentProvider),
                timestamp: new Date().toISOString(),
                latencyMs: Date.now() - startedAt,
                usage: {
                    historyItemsUsed: 0,
                    inputChars: String(req.body?.message || "").length,
                    outputChars: 0
                },
                fallback: true,
                fallbackReason: "quota_exceeded"
            });
        }

        console.error("Chat error:", error);

        return res.status(statusCode).json({
            success: false,
            error:
                statusCode === 429
                    ? "Provider quota/rate limit reached. Please check billing/limits and try again shortly."
                    : "Failed to process your request.",
            details: NODE_ENV === "development" ? error?.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

app.use((req, res) => {
    if (req.path === "/chat" || req.path === "/health" || req.path === "/config") {
        return res.status(404).json({ success: false, error: "Not found" });
    }

    return res.sendFile(path.join(staticRoot, "index.html"));
});

function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal) {
                return net.address;
            }
        }
    }
    return "localhost";
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://${getLocalIP()}:${PORT}`);
    console.log(`Provider: ${activeProvider}`);
    if (!hasGemini && !hasOpenAI) {
        console.warn("⚠️ No API key configured. Chat endpoint will return fallback responses.");
    }
    if (activeProvider === "gemini" && !hasGemini) {
        console.warn("⚠️ GEMINI_API_KEY is missing for selected provider.");
    }
    if (activeProvider === "openai" && !hasOpenAI) {
        console.warn("⚠️ OPENAI_API_KEY is missing for selected provider.");
    }
});
