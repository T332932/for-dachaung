"use strict";

require("dotenv").config();
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 3000;
const providerName = process.env.PROVIDER_NAME || "zujuan-local";

const availableModels = [
  {
    id: "gpt-4o-mini",
    object: "model",
    created: 1_708_000_000,
    owned_by: providerName,
  },
  {
    id: "gpt-3.5-turbo-instruct",
    object: "model",
    created: 1_706_000_000,
    owned_by: providerName,
  },
  {
    id: "text-embedding-3-small",
    object: "model",
    created: 1_706_500_000,
    owned_by: providerName,
  },
  {
    id: "omni-moderation-2024-09-10",
    object: "model",
    created: 1_706_800_000,
    owned_by: providerName,
  },
];

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan(process.env.NODE_ENV === "test" ? "tiny" : "dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/v1/models", (req, res) => {
  res.json({ object: "list", data: availableModels });
});

app.post("/v1/chat/completions", (req, res) => {
  const { messages = [], model = "gpt-4o-mini", stream = false } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return sendError(res, 400, "messages must be a non-empty array");
  }

  const created = nowSeconds();
  const id = `chatcmpl-${created}`;
  const text = buildChatReply(messages);
  const usage = buildUsage(countTokensFromMessages(messages), countTokens(text));

  if (stream) {
    return streamChatResponse(res, { id, model, created, content: text, usage });
  }

  res.json({
    id,
    object: "chat.completion",
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage,
    system_fingerprint: "zujuan-openai-stub",
  });
});

app.post("/v1/completions", (req, res) => {
  const {
    prompt = "",
    model = "gpt-3.5-turbo-instruct",
    stream = false,
    max_tokens = 256,
  } = req.body || {};

  const created = nowSeconds();
  const id = `cmpl-${created}`;
  const text = buildTextCompletion(prompt, max_tokens);
  const usage = buildUsage(countTokens(prompt), countTokens(text));

  if (stream) {
    return streamCompletionResponse(res, { id, model, created, content: text, usage });
  }

  res.json({
    id,
    object: "text_completion",
    created,
    model,
    choices: [
      {
        index: 0,
        text,
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage,
  });
});

app.post("/v1/embeddings", (req, res) => {
  const { input, model = "text-embedding-3-small", dimensions = 64 } = req.body || {};
  if (input === undefined || input === null) {
    return sendError(res, 400, "input is required");
  }

  const inputs = Array.isArray(input) ? input : [input];
  const dim = Math.max(8, Math.min(1024, Number(dimensions) || 64));
  const data = inputs.map((item, index) => ({
    object: "embedding",
    index,
    embedding: buildEmbedding(String(item), dim),
  }));

  res.json({
    object: "list",
    data,
    model,
    usage: {
      prompt_tokens: inputs.reduce((sum, text) => sum + countTokens(String(text)), 0),
      total_tokens: inputs.reduce((sum, text) => sum + countTokens(String(text)), 0),
    },
  });
});

app.post("/v1/moderations", (req, res) => {
  const { input, model = "omni-moderation-2024-09-10" } = req.body || {};
  if (input === undefined || input === null) {
    return sendError(res, 400, "input is required");
  }

  const text = Array.isArray(input) ? input.join(" ") : String(input);
  const flagged = containsUnsafeLanguage(text);
  const scores = buildModerationScores(text);

  res.json({
    id: `modr-${nowSeconds()}`,
    model,
    results: [
      {
        flagged,
        categories: {
          hate: scores.hate > 0.5,
          "hate/threatening": scores.hate > 0.8,
          self_harm: scores.self_harm > 0.6,
          sexual: scores.sexual > 0.6,
          "sexual/minors": false,
          violence: scores.violence > 0.6,
          "violence/graphic": scores.violence > 0.8,
        },
        category_scores: scores,
      },
    ],
  });
});

app.post("/v1/images/generations", (req, res) => {
  const { prompt = "abstract illustration", size = "512x512", response_format = "b64_json" } =
    req.body || {};
  const created = nowSeconds();
  const svg = svgPlaceholder(prompt, size);
  const b64 = Buffer.from(svg).toString("base64");

  res.json({
    created,
    data: [
      {
        b64_json: response_format === "b64_json" ? b64 : undefined,
        url: response_format === "url" ? `data:image/svg+xml;base64,${b64}` : undefined,
        revised_prompt: prompt,
      },
    ],
  });
});

app.post("/v1/audio/transcriptions", upload.single("file"), (req, res) => {
  const prompt = req.body?.prompt || "";
  const text = buildAudioText(req.file, prompt);
  res.json({ text });
});

app.post("/v1/audio/translations", upload.single("file"), (req, res) => {
  const prompt = req.body?.prompt || "";
  const text = buildAudioText(req.file, prompt, true);
  res.json({ text });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: {
      message: "Internal server error",
      type: "server_error",
    },
  });
});

app.listen(port, () => {
  console.log(`OpenAI-compatible API is running on http://localhost:${port}`);
});

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sendError(res, status, message) {
  return res.status(status).json({
    error: {
      message,
      type: "invalid_request_error",
    },
  });
}

function buildChatReply(messages) {
  const summary = messages
    .map((m) => `${m.role || "user"}: ${stringifyMessage(m.content)}`)
    .join(" | ");
  const hint = messages.find((m) => m.role === "system")?.content || "";
  const echo =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content || "";
  const base = stringifyMessage(echo) || "Hello from the OpenAI-compatible stub.";
  const prefix = hint ? `System noted: ${stringifyMessage(hint)}. ` : "";
  return `${prefix}${base} [echo] ${summary}`.slice(0, 500);
}

function buildTextCompletion(prompt, maxTokens) {
  const cleanPrompt = Array.isArray(prompt) ? prompt.join(" ") : String(prompt || "");
  const stub = `Echoed completion for: ${cleanPrompt}`.trim();
  return stub.slice(0, Math.max(16, maxTokens));
}

function chunkContent(text, size = 48) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [text];
}

function streamChatResponse(res, { id, model, created, content, usage }) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chunks = chunkContent(content);
  chunks.forEach((chunk, index) => {
    const payload = {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: index === 0 ? "assistant" : undefined,
            content: chunk,
          },
          finish_reason: null,
        },
      ],
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  const finalPayload = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
    usage,
  };
  res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function streamCompletionResponse(res, { id, model, created, content, usage }) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chunks = chunkContent(content);
  chunks.forEach((chunk) => {
    const payload = {
      id,
      object: "text_completion",
      created,
      model,
      choices: [
        {
          index: 0,
          text: chunk,
          finish_reason: null,
          logprobs: null,
        },
      ],
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  const finalPayload = {
    id,
    object: "text_completion",
    created,
    model,
    choices: [
      {
        index: 0,
        text: "",
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage,
  };
  res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function countTokens(text) {
  const str = Array.isArray(text) ? text.join(" ") : String(text || "");
  return Math.max(1, Math.ceil(str.split(/\s+/).filter(Boolean).join(" ").length / 4) + Math.ceil(str.length / 16));
}

function countTokensFromMessages(messages) {
  return messages.reduce((sum, m) => sum + countTokens(stringifyMessage(m.content)), 0);
}

function buildUsage(promptTokens, completionTokens) {
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

function buildEmbedding(text, dim) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed * 31 + text.charCodeAt(i)) % 997;
  }
  const vector = [];
  for (let i = 0; i < dim; i += 1) {
    const value = Math.sin(seed + i * 12.9898) * 43758.5453;
    vector.push(Number(((value - Math.floor(value)) * 2 - 1).toFixed(6)));
  }
  return vector;
}

function containsUnsafeLanguage(text) {
  const banned = ["bomb", "kill", "suicide", "hate"];
  const lowered = text.toLowerCase();
  return banned.some((term) => lowered.includes(term));
}

function buildModerationScores(text) {
  const base = containsUnsafeLanguage(text) ? 0.7 : 0.05;
  return {
    hate: base,
    "hate/threatening": base - 0.1 > 0 ? base - 0.1 : 0,
    self_harm: text.toLowerCase().includes("suicide") ? 0.85 : base / 2,
    sexual: text.toLowerCase().includes("sex") ? 0.65 : base / 3,
    "sexual/minors": 0,
    violence: text.toLowerCase().includes("kill") ? 0.82 : base,
    "violence/graphic": text.toLowerCase().includes("blood") ? 0.78 : base / 3,
  };
}

function svgPlaceholder(prompt, size) {
  const safePrompt = escapeXml(String(prompt)).slice(0, 100);
  const [w, h] = size.split("x").map((n) => Number(n) || 512);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="#ffffff" font-size="18" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">${safePrompt}</text></svg>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stringifyMessage(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && part.text) return part.text;
        return JSON.stringify(part);
      })
      .join(" ");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

function buildAudioText(file, prompt, translate = false) {
  const prefix = translate ? "Translated transcript" : "Transcription";
  const fileName = file ? file.originalname : "audio";
  const hint = prompt ? ` Prompt: ${prompt}` : "";
  return `${prefix} for ${fileName}.${hint}`.trim();
}
