/**
 * Custom Prometheus metrics
 *
 * All application-level counters, histograms and gauges are defined here
 * so they can be imported anywhere without creating duplicate registrations.
 *
 * Default Node.js / process metrics are collected separately via
 * `collectDefaultMetrics()` in server.ts.
 */
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
  register as defaultRegister,
} from "prom-client";

// Re-use the global default registry so that collectDefaultMetrics() and our
// custom metrics all live in the same registry (exposed on /metrics).
export const metricsRegistry: Registry = defaultRegister;

// ---------------------------------------------------------------------------
// HTTP metrics
// ---------------------------------------------------------------------------

/** Total HTTP requests served, labelled by method, normalised route, status. */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

/** Histogram of HTTP request durations (seconds). */
export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/** Number of HTTP requests currently being processed. */
export const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently being processed",
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Auth / security metrics
// ---------------------------------------------------------------------------

/** Auth failures, labelled by reason (invalid_key, expired_key, missing_key, etc.). */
export const authFailuresTotal = new Counter({
  name: "auth_failures_total",
  help: "Total number of authentication failures",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Rate-limiting / quota metrics
// ---------------------------------------------------------------------------

/** Rate-limit rejections, labelled by tier and normalised route. */
export const rateLimitExceededTotal = new Counter({
  name: "rate_limit_exceeded_total",
  help: "Total number of rate-limit rejections",
  labelNames: ["tier", "route"] as const,
  registers: [metricsRegistry],
});

/** Quota exhaustion events, labelled by tier and quota type. */
export const quotaExceededTotal = new Counter({
  name: "quota_exceeded_total",
  help: "Total number of quota-exceeded rejections",
  labelNames: ["tier", "quota_type"] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Slow-request metric
// ---------------------------------------------------------------------------

/**
 * Requests that exceeded the slow-request threshold.
 * Threshold is configured via SLOW_REQUEST_MS env var (default 2000 ms).
 */
export const slowRequestsTotal = new Counter({
  name: "slow_requests_total",
  help: "Total number of requests that exceeded the slow-request threshold",
  labelNames: ["method", "route"] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Utility: normalise Express path to a low-cardinality route label
// ---------------------------------------------------------------------------

/**
 * Strips dynamic segments from a request path so that metrics don't explode
 * with one label value per UUID / numeric ID.
 *
 * Examples:
 *   /v1/chains/1/tokens  → /v1/chains/:id/tokens
 *   /v1/keys/abc123       → /v1/keys/:id
 */
export function normaliseRoute(path: string): string {
  return path
    .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,35}/g, "/:uuid") // UUIDs
    .replace(/\/\d+/g, "/:id") // plain numeric IDs
    .replace(/\/[a-fA-F0-9]{32,64}/g, "/:hash"); // hex hashes / API-key prefixes
}

// ---------------------------------------------------------------------------
// Safe initialisation guard
// ---------------------------------------------------------------------------

let _defaultMetricsCollected = false;

/**
 * Call once at server boot to register default Node.js / process metrics.
 * Idempotent – safe to call multiple times (e.g., during hot-reload in dev).
 */
export function initDefaultMetrics(): void {
  if (_defaultMetricsCollected) return;
  try {
    collectDefaultMetrics({ register: metricsRegistry });
    _defaultMetricsCollected = true;
  } catch (err: any) {
    if (!err?.message?.includes("already been registered")) throw err;
    _defaultMetricsCollected = true;
  }
}
