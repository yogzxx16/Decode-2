/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          DecodeLabs Articles API — Integration Tests        ║
 * ║   Native Node.js fetch · No external test libraries         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Run:  node test.js
 * Requires: server already running on http://localhost:3000
 *
 * Test suite:
 *   [T1]  GET  /articles        → 200 OK  + valid JSON array
 *   [T2]  POST /articles        → 201 Created + echo of new resource
 *   [T3]  POST /articles        → 400 Bad Request (intentionally broken payload)
 */

'use strict';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────
// ANSI COLOUR HELPERS  (no chalk, no deps)
// ─────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

const ok = (msg) => `${C.green}✔${C.reset}  ${msg}`;
const err = (msg) => `${C.red}✘${C.reset}  ${msg}`;
const dim = (msg) => `${C.dim}${msg}${C.reset}`;

// ─────────────────────────────────────────────
// ASSERTION ENGINE
// ─────────────────────────────────────────────

/**
 * Micro-assertion that throws a descriptive Error on failure.
 * @param {boolean} condition   Result of the boolean check
 * @param {string}  label       Human-readable name of the assertion
 * @param {string}  [detail]    Optional extra context appended on failure
 */
function assert(condition, label, detail = '') {
  if (!condition) {
    const msg = detail ? `${label} — ${detail}` : label;
    throw new AssertionError(msg);
  }
  console.log(`    ${ok(label)}`);
}

/** Custom error class so we can distinguish assertion failures from network errors */
class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

// ─────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────

/** Pretty-print a request/response pair with a minimal log structure */
function logTransaction(method, path, status, body) {
  const statusColor = status >= 500 ? C.red
    : status >= 400 ? C.yellow
      : C.green;

  console.log(dim('  ┌─ Request ───────────────────────────────────────'));
  console.log(dim(`  │  ${C.bold}${method}${C.reset}${C.dim} ${BASE_URL}${path}`));
  console.log(dim(`  │  Status: ${statusColor}${status}${C.reset}`));
  console.log(dim('  ├─ Response body ─────────────────────────────────'));

  const lines = JSON.stringify(body, null, 2).split('\n');
  // Show up to 20 lines to avoid flooding the console on large collections
  const preview = lines.slice(0, 20);
  for (const line of preview) {
    console.log(dim(`  │  ${line}`));
  }
  if (lines.length > 20) {
    console.log(dim(`  │  … (${lines.length - 20} more lines omitted)`));
  }
  console.log(dim('  └─────────────────────────────────────────────────'));
}

/** Print a bold test header banner */
function printTestHeader(index, title) {
  console.log('');
  console.log(`${C.cyan}${C.bold}  [T${index}] ${title}${C.reset}`);
  console.log(dim('  ─────────────────────────────────────────────────'));
}

/** Print a pass/fail footer for each test */
function printTestResult(passed, testName) {
  if (passed) {
    console.log(`\n  ${C.bgGreen}${C.bold} PASS ${C.reset}  ${C.green}${testName}${C.reset}`);
  } else {
    console.log(`\n  ${C.bgRed}${C.bold} FAIL ${C.reset}  ${C.red}${testName}${C.reset}`);
  }
}

// ─────────────────────────────────────────────
// SHARED FETCH WRAPPER
// ─────────────────────────────────────────────

/**
 * Fire a JSON request and return { status, body }.
 * Throws on network-level failure (server unreachable, etc.).
 *
 * @param {string} method   HTTP verb
 * @param {string} path     URL path (e.g. '/articles')
 * @param {object} [data]   Optional request body (will be JSON-serialised)
 * @returns {Promise<{ status: number, body: object }>}
 */
async function request(method, path, data) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  // Always parse as JSON — our server guarantees Content-Type: application/json
  const body = await response.json();

  return { status: response.status, body };
}

// ─────────────────────────────────────────────
// TEST DEFINITIONS
// ─────────────────────────────────────────────

/**
 * T1 — Safe Retrieval
 * GET /articles must return 200 and a valid articles collection.
 */
async function testGetAllArticles() {
  const TITLE = 'GET /articles → 200 OK + valid JSON collection';
  printTestHeader(1, TITLE);

  try {
    const { status, body } = await request('GET', '/articles');
    logTransaction('GET', '/articles', status, body);

    // ── Assertions ──────────────────────────────────────────
    assert(status === 200,
      'HTTP status is 200',
      `received ${status}`);

    assert(body.success === true,
      'Response envelope success flag is true');

    assert(typeof body.data === 'object' && body.data !== null,
      'Response body.data exists and is an object');

    assert(Array.isArray(body.data.articles),
      'body.data.articles is an Array',
      `got ${typeof body.data.articles}`);

    assert(typeof body.data.count === 'number',
      'body.data.count is a number',
      `got ${typeof body.data.count}`);

    assert(body.data.count === body.data.articles.length,
      'count matches actual articles array length',
      `count=${body.data.count}, array.length=${body.data.articles.length}`);

    assert(body.data.articles.length >= 1,
      'At least one article exists in the store');

    // Spot-check the shape of the first article
    const first = body.data.articles[0];
    for (const key of ['id', 'title', 'category', 'author', 'body', 'createdAt']) {
      assert(Object.prototype.hasOwnProperty.call(first, key),
        `First article has required field: "${key}"`);
    }

    printTestResult(true, TITLE);
    return true;

  } catch (e) {
    handleTestError(e, TITLE);
    return false;
  }
}

/**
 * T2 — Successful Mutation
 * POST /articles with a perfectly valid payload must return 201 and
 * echo back the newly created resource including its generated ID.
 */
async function testCreateArticle() {
  const TITLE = 'POST /articles → 201 Created + new resource echoed';
  printTestHeader(2, TITLE);

  const VALID_PAYLOAD = {
    title: 'Understanding the Node.js Event Loop',
    category: 'development',
    author: 'Yogesh Kumar',
    body: 'The event loop is the secret engine behind Node.js non-blocking I/O. ' +
      'Understanding its phases — timers, pending callbacks, poll, check, close — ' +
      'unlocks the ability to write highly performant server-side JavaScript.',
  };

  try {
    const { status, body } = await request('POST', '/articles', VALID_PAYLOAD);
    logTransaction('POST', '/articles', status, body);

    // ── Assertions ──────────────────────────────────────────
    assert(status === 201,
      'HTTP status is 201 Created',
      `received ${status}`);

    assert(body.success === true,
      'Response envelope success flag is true');

    assert(typeof body.data === 'object' && body.data !== null,
      'Response body.data exists and is an object');

    const resource = body.data;

    assert(typeof resource.id === 'string' && resource.id.length === 12,
      'Newly created resource has a 12-char hex ID',
      `got "${resource.id}" (length ${resource.id?.length})`);

    assert(resource.title === VALID_PAYLOAD.title,
      'Echoed title matches submitted title');

    assert(resource.category === VALID_PAYLOAD.category,
      'Echoed category matches submitted category');

    assert(resource.author === VALID_PAYLOAD.author,
      'Echoed author matches submitted author');

    assert(typeof resource.createdAt === 'string',
      'Resource has a createdAt timestamp string');

    // Validate the timestamp is a parseable ISO-8601 date
    const parsedDate = new Date(resource.createdAt);
    assert(!isNaN(parsedDate.getTime()),
      'createdAt is a valid ISO-8601 date string',
      `received "${resource.createdAt}"`);

    printTestResult(true, TITLE);
    return true;

  } catch (e) {
    handleTestError(e, TITLE);
    return false;
  }
}

/**
 * T3 — The Gatekeeper Rule (Syntactic + Semantic Defence)
 * POST /articles with an intentionally malformed payload must be
 * intercepted at the blood-brain barrier and returned as 400 Bad Request.
 *
 * Payload crimes committed:
 *   • title   — only 3 chars (≤5 minimum)
 *   • category — "gaming" is not in [design, development, strategy]
 *   • author  — missing entirely
 *   • body    — a Number instead of a String (type violation)
 */
async function testRejectBadPayload() {
  const TITLE = 'POST /articles (bad payload) → 400 Bad Request + issues array';
  printTestHeader(3, TITLE);

  const BAD_PAYLOAD = {
    title: 'Hi',          // too short (3 chars, needs > 5)
    category: 'gaming',     // not a valid category
    // author:  intentionally omitted
    body: 42,            // wrong type — Number instead of String
  };

  try {
    const { status, body } = await request('POST', '/articles', BAD_PAYLOAD);
    logTransaction('POST', '/articles', status, body);

    // ── Assertions ──────────────────────────────────────────
    assert(status === 400,
      'HTTP status is 400 Bad Request',
      `received ${status}`);

    assert(body.success === false,
      'Response envelope success flag is false (request rejected)');

    assert(body.error === 'Bad Request',
      'Response error label is "Bad Request"');

    assert(Array.isArray(body.issues),
      'Response contains an issues array',
      `got ${typeof body.issues}`);

    assert(body.issues.length >= 1,
      'At least one validation issue was reported',
      `issues array is empty`);

    // Verify the server did NOT create a resource (no id, no createdAt)
    assert(body.data === undefined,
      'No data / resource was returned in a 400 response');

    // Log each reported issue so the output is educational
    console.log(dim(''));
    console.log(dim('  │  Validation issues reported by server:'));
    body.issues.forEach((issue, i) => {
      console.log(`    ${err(`[issue ${i + 1}] ${issue}`)}`);
    });

    printTestResult(true, TITLE);
    return true;

  } catch (e) {
    handleTestError(e, TITLE);
    return false;
  }
}

// ─────────────────────────────────────────────
// ERROR HANDLER  (shared across all tests)
// ─────────────────────────────────────────────

/**
 * Differentiate between:
 *   - AssertionError  → test logic failed (wrong status, bad shape, etc.)
 *   - TypeError (fetch network)  → server unreachable
 *   - Everything else  → unexpected runtime error (maps to 500-class issues)
 */
function handleTestError(e, testName) {
  if (e instanceof AssertionError) {
    console.log(`\n    ${err(`Assertion failed: ${e.message}`)}`);
  } else if (e instanceof TypeError && e.message.includes('fetch')) {
    console.log(`\n    ${err('Network error — is the server running on ' + BASE_URL + '?')}`);
    console.log(dim(`    ${e.message}`));
  } else {
    // Unexpected runtime error — print full stack for debugging
    console.log(`\n    ${err('Unexpected runtime error (possible 500-class fault):')}`);
    console.log(C.red + (e.stack || e.message) + C.reset);
  }
  printTestResult(false, testName);
}

// ─────────────────────────────────────────────
// TEST RUNNER  (sequential, aggregated summary)
// ─────────────────────────────────────────────

async function runAll() {
  const START = Date.now();

  console.log('');
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║     DecodeLabs Articles API — Test Suite         ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(dim(`  Target: ${BASE_URL}`));
  console.log(dim(`  Time:   ${new Date().toISOString()}`));

  // Run tests sequentially — order matters (GET before mutations)
  const results = [];
  results.push(await testGetAllArticles());
  results.push(await testCreateArticle());
  results.push(await testRejectBadPayload());

  // ── Aggregated summary ───────────────────────────────────
  const elapsed = Date.now() - START;
  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  const allPass = failed === 0;

  console.log('');
  console.log(dim('  ══════════════════════════════════════════════════'));
  console.log(`${C.bold}  Summary${C.reset}`);
  console.log(dim('  ──────────────────────────────────────────────────'));
  console.log(`  Tests run:    ${C.bold}${results.length}${C.reset}`);
  console.log(`  Passed:       ${C.green}${C.bold}${passed}${C.reset}`);
  console.log(`  Failed:       ${failed > 0 ? C.red : C.dim}${C.bold}${failed}${C.reset}`);
  console.log(`  Duration:     ${C.dim}${elapsed}ms${C.reset}`);
  console.log(dim('  ══════════════════════════════════════════════════'));

  if (allPass) {
    console.log(`\n  ${C.bgGreen}${C.bold}  ALL TESTS PASSED  ${C.reset}\n`);
  } else {
    console.log(`\n  ${C.bgRed}${C.bold}  ${failed} TEST(S) FAILED  ${C.reset}\n`);
  }

  // Exit with appropriate code so CI pipelines can detect failures
  process.exit(allPass ? 0 : 1);
}

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────
runAll();
