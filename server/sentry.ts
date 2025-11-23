/**
 * Optional Sentry error tracking integration
 *
 * Sentry is OPTIONAL - the application will work perfectly fine without it.
 * Only configure if you want error tracking and monitoring.
 *
 * To enable:
 * 1. Set SENTRY_DSN environment variable
 * 2. Optionally set SENTRY_ENVIRONMENT (defaults to NODE_ENV)
 * 3. Optionally set SENTRY_TRACES_SAMPLE_RATE (defaults to 0.1 = 10%)
 */

import type { Express, Request, Response, NextFunction } from "express";

let Sentry: any = null;
let isSentryEnabled = false;

/**
 * Initialize Sentry if configured (completely optional)
 */
export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN;

  // If no DSN is configured, Sentry is disabled
  if (!sentryDsn) {
    console.log("ℹ️  Sentry is not configured (SENTRY_DSN not set). Error tracking disabled.");
    return;
  }

  try {
    // Dynamically import Sentry only if needed
    Sentry = require("@sentry/node");
    const { ProfilingIntegration } = require("@sentry/profiling-node");

    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
      integrations: [
        new ProfilingIntegration(),
      ],
    });

    isSentryEnabled = true;
    console.log("✅ Sentry error tracking initialized");
  } catch (error) {
    console.warn("⚠️  Failed to initialize Sentry:", error);
    console.warn("⚠️  Continuing without error tracking...");
  }
}

/**
 * Setup Sentry request handlers (optional)
 */
export function setupSentryMiddleware(app: Express) {
  if (!isSentryEnabled || !Sentry) {
    return;
  }

  try {
    // Request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  } catch (error) {
    console.warn("⚠️  Failed to setup Sentry middleware:", error);
  }
}

/**
 * Setup Sentry error handler (optional)
 * Must be added AFTER all routes but BEFORE other error handlers
 */
export function setupSentryErrorHandler(app: Express) {
  if (!isSentryEnabled || !Sentry) {
    return;
  }

  try {
    // Error handler must be added before any other error middleware
    app.use(Sentry.Handlers.errorHandler());
  } catch (error) {
    console.warn("⚠️  Failed to setup Sentry error handler:", error);
  }
}

/**
 * Capture an exception (only if Sentry is enabled)
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!isSentryEnabled || !Sentry) {
    // Just log to console if Sentry is not available
    console.error("Error:", error);
    if (context) {
      console.error("Context:", context);
    }
    return;
  }

  try {
    if (context) {
      Sentry.captureException(error, { extra: context });
    } else {
      Sentry.captureException(error);
    }
  } catch (err) {
    console.error("Failed to capture exception in Sentry:", err);
  }
}

/**
 * Capture a message (only if Sentry is enabled)
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (!isSentryEnabled || !Sentry) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    console.error("Failed to capture message in Sentry:", err);
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryConfigured(): boolean {
  return isSentryEnabled;
}
