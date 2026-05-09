const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_TIMEOUT_MS = 120_000; // 120 seconds
const DEFAULT_MODEL = 'deepseek-chat';
const ALLOWED_MODELS = new Set([DEFAULT_MODEL]);
const ALLOWED_RESPONSE_FORMAT_TYPES = new Set(['json_object']);

// ── Helpers ──────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function getClientIP(req) {
  return req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function normalizeTemperature(value) {
  if (value === undefined) return 0.3;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(2, Math.max(0, value));
}

function normalizeResponseFormat(value) {
  if (!value) return null;
  if (
    typeof value === 'object'
    && !Array.isArray(value)
    && ALLOWED_RESPONSE_FORMAT_TYPES.has(value.type)
  ) {
    return { type: value.type };
  }
  return undefined;
}

// ── Middleware ────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Rate limiter: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Try again in 60 seconds.',
    });
  },
});

// Apply rate limiter only to /api/generate
app.use('/api/generate', limiter);

// ── Health check ─────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Main endpoint ────────────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  const ip = getClientIP(req);
  let model = DEFAULT_MODEL;

  try {
    // ── Validate input ──
    const { messages, temperature } = req.body;
    model = req.body.model || model;

    if (!ALLOWED_MODELS.has(model)) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'Unsupported model',
      });
    }

    const safeTemperature = normalizeTemperature(temperature);
    if (safeTemperature === null) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'temperature must be a finite number',
      });
    }

    const safeResponseFormat = normalizeResponseFormat(req.body.response_format);
    if (safeResponseFormat === undefined) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'Unsupported response_format',
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'messages is required and must be a non-empty array',
      });
    }

    // Validate each message has role and content
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        console.log(
          `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
        );
        return res.status(400).json({
          success: false,
          error: `messages[${i}] must have "role" and "content" as strings`,
        });
      }
    }

    // ── Check API key ──
    if (!DEEPSEEK_API_KEY) {
      console.error(`[${timestamp()}] DEEPSEEK_API_KEY is not set!`);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }

    // ── Call DeepSeek API ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

    let deepseekRes;
    try {
      deepseekRes = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: safeTemperature,
          messages,
          ...(safeResponseFormat ? { response_format: safeResponseFormat } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        console.log(
          `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 504`
        );
        return res.status(504).json({
          success: false,
          error: 'AI response timeout',
        });
      }

      console.error(`[${timestamp()}] DeepSeek fetch error:`, err.message);
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 502`
      );
      return res.status(502).json({
        success: false,
        error: 'AI service error',
      });
    }

    clearTimeout(timeoutId);

    // ── Handle DeepSeek errors ──
    if (!deepseekRes.ok) {
      const status = deepseekRes.status;
      let errorMsg = 'AI service error';

      if (status === 401 || status === 403) {
        errorMsg = 'AI service auth error';
      }

      console.error(
        `[${timestamp()}] DeepSeek API returned ${status}`
      );
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 502`
      );
      return res.status(502).json({
        success: false,
        error: errorMsg,
      });
    }

    // ── Parse response ──
    const data = await deepseekRes.json();
    const content = data?.choices?.[0]?.message?.content;

    if (content === undefined || content === null) {
      console.error(`[${timestamp()}] DeepSeek returned no content in choices`);
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 502`
      );
      return res.status(502).json({
        success: false,
        error: 'AI service error',
      });
    }

    // ── Success ──
    console.log(
      `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 200`
    );
    return res.json({
      success: true,
      content,
    });

  } catch (err) {
    console.error(`[${timestamp()}] Unexpected error:`, err);
    console.log(
      `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 500`
    );
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ── Start server ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[${timestamp()}] Chartici API proxy listening on port ${PORT}`);
  console.log(`[${timestamp()}] DeepSeek API key: ${DEEPSEEK_API_KEY ? '✓ set' : '✗ NOT SET'}`);
});
