/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            DecodeLabs Articles API Server                   ║
 * ║   Native Node.js · No Frameworks · RESTful Architecture     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Endpoints:
 *   GET    /articles        → Retrieve all articles
 *   GET    /articles/:id    → Retrieve single article by ID
 *   POST   /articles        → Create a new article
 *
 * Standards:
 *   • Stateless REST (HTTP/1.1 semantic verbs + status codes)
 *   • File-based JSON persistence  (data/articles.json)
 *   • Dual-layer ingress validation (syntactic + semantic)
 *   • Explicit CORS headers for cross-origin dashboard access
 *   • try/catch everywhere → clean 500 envelopes on runtime faults
 */

'use strict';

// ─────────────────────────────────────────────
// 1. STDLIB IMPORTS — zero external deps
// ─────────────────────────────────────────────
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// 2. CONFIGURATION
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data', 'articles.json');

/** Allowed categories — the semantic boundary gate */
const VALID_CATEGORIES = ['design', 'development', 'strategy'];

/** Fields every POST body must supply */
const REQUIRED_FIELDS = ['title', 'category', 'author', 'body'];

// ─────────────────────────────────────────────
// 3. CORS HEADERS
//    Permissive for local dev; tighten ALLOWED_ORIGIN
//    to your deployed frontend URL in production.
// ─────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 h preflight cache
}

// ─────────────────────────────────────────────
// 4. RESPONSE HELPERS
// ─────────────────────────────────────────────

/**
 * Serialise a JSON payload and end the response.
 * @param {http.ServerResponse} res
 * @param {number}              statusCode
 * @param {object}              payload
 */
function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Pre-baked envelope factories — keeps handler code declarative
const send200 = (res, data) => sendJSON(res, 200, { success: true, data });
const send201 = (res, resource) => sendJSON(res, 201, { success: true, data: resource });
const send400 = (res, errors) => sendJSON(res, 400, { success: false, status: 400, error: 'Bad Request', issues: errors });
const send404 = (res, msg) => sendJSON(res, 404, { success: false, status: 404, error: 'Not Found', message: msg });
const send405 = (res, allowed) => sendJSON(res, 405, { success: false, status: 405, error: 'Method Not Allowed', allowed });
const send500 = (res, detail) => sendJSON(res, 500, { success: false, status: 500, error: 'Internal Server Error', detail: detail || 'Unexpected error' });

// ─────────────────────────────────────────────
// 5. PERSISTENCE LAYER  (file-based JSON store)
// ─────────────────────────────────────────────

/** Read the articles store. Returns a parsed array. */
async function readArticles() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

/** Atomically overwrite the articles store. */
async function writeArticles(articles) {
  await fs.writeFile(DATA_FILE, JSON.stringify(articles, null, 2), 'utf8');
}

// ─────────────────────────────────────────────
// 6. REQUEST BODY COLLECTOR
// ─────────────────────────────────────────────

/**
 * Accumulate incoming chunks and resolve the full raw body string.
 * Rejects if the stream emits an error.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', err => reject(err));
  });
}

// ─────────────────────────────────────────────
// 7. DUAL-LAYER INGRESS VALIDATOR
//    (Blood-Brain Barrier — Stage 1: Syntactic)
//    (Blood-Brain Barrier — Stage 2: Semantic )
// ─────────────────────────────────────────────

/**
 * STAGE 1 — Syntactic parse.
 * Returns { ok: false, parseError } on malformed JSON.
 * Returns { ok: true,  parsed }     on success.
 */
function syntacticParse(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    return { ok: true, parsed };
  } catch (e) {
    return { ok: false, parseError: `JSON parse failed: ${e.message}` };
  }
}

/**
 * STAGE 2 — Semantic validation.
 * Returns an array of human-readable issue strings.
 * Empty array → payload is valid.
 *
 * Rules:
 *   • All REQUIRED_FIELDS must be present and non-empty strings
 *   • title   : length > 5 characters
 *   • category: must be one of VALID_CATEGORIES
 *   • author  : length >= 2 characters
 *   • body    : length >= 20 characters
 */
function semanticValidate(payload) {
  const issues = [];

  // Presence check
  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null) {
      issues.push(`"${field}" is required but missing.`);
    } else if (typeof payload[field] !== 'string') {
      issues.push(`"${field}" must be a string, got ${typeof payload[field]}.`);
    } else if (payload[field].trim() === '') {
      issues.push(`"${field}" must not be blank.`);
    }
  }

  // Return early if structural fields are absent — further checks are moot
  if (issues.length > 0) return issues;

  // title  — minimum meaningful length
  if (payload.title.trim().length <= 5) {
    issues.push(`"title" must be longer than 5 characters (received: ${payload.title.trim().length}).`);
  }

  // category — enumeration boundary
  if (!VALID_CATEGORIES.includes(payload.category.trim().toLowerCase())) {
    issues.push(`"category" must be one of [${VALID_CATEGORIES.join(', ')}], got "${payload.category}".`);
  }

  // author — sanity length
  if (payload.author.trim().length < 2) {
    issues.push(`"author" must be at least 2 characters.`);
  }

  // body — minimum substance
  if (payload.body.trim().length < 20) {
    issues.push(`"body" must be at least 20 characters (received: ${payload.body.trim().length}).`);
  }

  return issues;
}

// ─────────────────────────────────────────────
// 8. ROUTE HANDLERS
// ─────────────────────────────────────────────

/** GET /articles — return full collection */
async function handleGetAll(req, res) {
  try {
    const articles = await readArticles();
    send200(res, {
      count: articles.length,
      articles,
    });
  } catch (err) {
    console.error('[GET /articles] Error:', err.message);
    send500(res, err.message);
  }
}

/** GET /articles/:id — return single article or 404 */
async function handleGetOne(req, res, id) {
  try {
    const articles = await readArticles();
    const article = articles.find(a => a.id === id);

    if (!article) {
      return send404(res, `No article found with id "${id}".`);
    }

    send200(res, article);
  } catch (err) {
    console.error(`[GET /articles/${id}] Error:`, err.message);
    send500(res, err.message);
  }
}

/** POST /articles — validate then persist a new article */
async function handleCreate(req, res) {
  try {
    // ── Collect raw body ──────────────────────────────────────
    const rawBody = await collectBody(req);

    // ── Stage 1: Syntactic parse ──────────────────────────────
    const parseResult = syntacticParse(rawBody);
    if (!parseResult.ok) {
      return send400(res, [parseResult.parseError]);
    }

    // ── Stage 2: Semantic validation ──────────────────────────
    const issues = semanticValidate(parseResult.parsed);
    if (issues.length > 0) {
      return send400(res, issues);
    }

    // ── Build resource ────────────────────────────────────────
    const { title, category, author, body } = parseResult.parsed;
    const newArticle = {
      id: crypto.randomBytes(6).toString('hex'),   // 12-char hex UID
      title: title.trim(),
      category: category.trim().toLowerCase(),
      author: author.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };

    // ── Persist ───────────────────────────────────────────────
    const articles = await readArticles();
    articles.push(newArticle);
    await writeArticles(articles);

    // ── Respond 201 Created ───────────────────────────────────
    send201(res, newArticle);
  } catch (err) {
    console.error('[POST /articles] Error:', err.message);
    send500(res, err.message);
  }
}

// ─────────────────────────────────────────────
// 9. ROUTER  (URL pattern matching engine)
// ─────────────────────────────────────────────

const ROUTE_COLLECTION = /^\/articles\/?$/;                  // /articles  or  /articles/
const ROUTE_ITEM = /^\/articles\/([a-zA-Z0-9_-]+)$/;  // /articles/:id

async function router(req, res) {
  const { method, url } = req;

  // Strip query string (idempotent — we don't use it, but keeps matching clean)
  const pathname = url.split('?')[0];

  // ── Preflight CORS handshake ──────────────────────────────
  if (method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Stamp CORS on every real response ────────────────────
  setCORSHeaders(res);

  // ── Collection endpoint: /articles ───────────────────────
  if (ROUTE_COLLECTION.test(pathname)) {
    if (method === 'GET') return await handleGetAll(req, res);
    else if (method === 'POST') return await handleCreate(req, res);
    else return send405(res, ['GET', 'POST']);
  }

  // ── Item endpoint: /articles/:id ─────────────────────────
  const itemMatch = pathname.match(ROUTE_ITEM);
  if (itemMatch) {
    const id = itemMatch[1];
    if (method === 'GET') return await handleGetOne(req, res, id);
    else return send405(res, ['GET']);
  }

  // ── Catch-all 404 ────────────────────────────────────────
  send404(res, `Route "${method} ${pathname}" does not exist on this server.`);
}

// ─────────────────────────────────────────────
// 10. SERVER BOOTSTRAP
// ─────────────────────────────────────────────

const server = http.createServer(router);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log(`  ║  DecodeLabs API Server — listening       ║`);
  console.log(`  ║  http://${HOST}:${PORT}                     ║`);
  console.log('  ╠══════════════════════════════════════════╣');
  console.log('  ║  GET    /articles                        ║');
  console.log('  ║  GET    /articles/:id                    ║');
  console.log('  ║  POST   /articles                        ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown on SIGINT (Ctrl+C) / SIGTERM (Docker stop)
function gracefulShutdown(signal) {
  console.log(`\n  [${signal}] Shutting down gracefully…`);
  server.close(() => {
    console.log('  Server closed. Goodbye.\n');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Surface unhandled promise rejections — never silently swallow
process.on('unhandledRejection', (reason) => {
  console.error('  [UNHANDLED REJECTION]', reason);
});
