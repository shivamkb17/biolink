import rateLimit from "express-rate-limit";

/**
 * Rate limiter for authentication endpoints (login, register, password reset)
 * Prevents brute force attacks and credential stuffing
 *
 * Configuration:
 * - 5 requests per 15 minutes per IP address
 * - Returns 429 status code when limit exceeded
 * - Includes retry-after header
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (only count failed attempts)
  skipSuccessfulRequests: false,
  // Skip failed requests (count all attempts)
  skipFailedRequests: false,
});

/**
 * More lenient rate limiter for email verification and password reset requests
 *
 * Configuration:
 * - 3 requests per hour per IP address
 * - Prevents abuse of email sending functionality
 */
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: "Too many email requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter for all other endpoints
 *
 * Configuration:
 * - 100 requests per 15 minutes per IP address
 * - Prevents API abuse and DoS attacks
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
