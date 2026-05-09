const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_TIMEOUT_MS = 120_000; // 120 seconds
const DEFAULT_MODEL = 'deepseek-chat';
const ALLOWED_MODELS = new Set([DEFAULT_MODEL]);
const ALLOWED_TASKS = new Set(['plan', 'build', 'repair']);

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

async function getPromptBuilders() {
  return import('../src/assets/systemPrompts.js');
}

function trimText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function normalizeDiagramType(value) {
  const dt = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(dt)) return null;
  return dt;
}

function normalizeErrors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getRepairMessages(phase2Prompt, extendedPrompt, rawContent, errors) {
  return [
    { role: 'system', content: phase2Prompt },
    {
      role: 'user',
      content: `Your previous Markdown could not be parsed or failed quality checks.

Return ONLY corrected Markdown tables for the same diagram type.
Do not explain anything.
Do not use JSON.
Do not wrap the answer in XML tags.
Keep the diagram compact and book-readable.

Original task:
${extendedPrompt}

Validation errors:
${errors.map(error => `- ${error}`).join('\n') || '- invalid diagram'}

Previous answer:
${rawContent || '(empty response)'}`
    }
  ];
}

async function buildAiRequest(body) {
  const task = String(body.task || '').trim().toLowerCase();
  if (!ALLOWED_TASKS.has(task)) {
    return { error: 'Unsupported generation task' };
  }

  const { getSystemPromptPhase1, getSystemPromptPhase2 } = await getPromptBuilders();

  if (task === 'plan') {
    const userPrompt = trimText(body.userPrompt, 4000);
    if (!userPrompt) return { error: 'userPrompt is required' };
    return {
      temperature: 0.3,
      messages: [
        { role: 'system', content: getSystemPromptPhase1() },
        { role: 'user', content: userPrompt },
      ],
    };
  }

  const diagramType = normalizeDiagramType(body.diagramType);
  const extendedPrompt = trimText(body.extendedPrompt, 8000);
  if (!diagramType) return { error: 'diagramType is required' };
  if (!extendedPrompt) return { error: 'extendedPrompt is required' };

  const phase2Prompt = getSystemPromptPhase2(diagramType);
  if (task === 'build') {
    return {
      temperature: 0.1,
      messages: [
        { role: 'system', content: phase2Prompt },
        { role: 'user', content: extendedPrompt },
      ],
    };
  }

  const rawContent = trimText(body.rawContent || '(empty response)', 12000);
  const errors = normalizeErrors(body.errors);
  return {
    temperature: 0.05,
    messages: getRepairMessages(phase2Prompt, extendedPrompt, rawContent || '', errors),
  };
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
    if (
      Object.prototype.hasOwnProperty.call(req.body, 'messages')
      || Object.prototype.hasOwnProperty.call(req.body, 'model')
      || Object.prototype.hasOwnProperty.call(req.body, 'temperature')
      || Object.prototype.hasOwnProperty.call(req.body, 'response_format')
    ) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'Raw model parameters are not accepted',
      });
    }

    if (!ALLOWED_MODELS.has(model)) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: 'Unsupported model',
      });
    }

    const aiRequest = await buildAiRequest(req.body || {});
    if (aiRequest.error) {
      console.log(
        `[${timestamp()}] POST /api/generate | IP: ${ip} | model: ${model} | response_time: ${Date.now() - startTime}ms | status: 400`
      );
      return res.status(400).json({
        success: false,
        error: aiRequest.error,
      });
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
          temperature: aiRequest.temperature,
          messages: aiRequest.messages,
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
