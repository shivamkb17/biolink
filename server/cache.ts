/**
 * Optional Redis caching layer
 *
 * Redis is OPTIONAL - the application will work perfectly fine without it.
 * Only configure if you want to improve performance with caching.
 *
 * To enable:
 * 1. Set REDIS_URL environment variable (e.g., redis://localhost:6379)
 * 2. Optionally set REDIS_CACHE_TTL (default: 3600 seconds = 1 hour)
 */

let redisClient: any = null;
let isRedisEnabled = false;

// Default cache TTL (1 hour)
const DEFAULT_CACHE_TTL = 3600;
const cacheTTL = parseInt(process.env.REDIS_CACHE_TTL || String(DEFAULT_CACHE_TTL), 10);

/**
 * Initialize Redis connection (completely optional)
 */
export async function initRedis() {
  const redisUrl = process.env.REDIS_URL;

  // If no URL is configured, Redis is disabled
  if (!redisUrl) {
    console.log("ℹ️  Redis is not configured (REDIS_URL not set). Caching disabled.");
    return;
  }

  try {
    // Dynamically import Redis only if needed
    const { createClient } = require("redis");

    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on("error", (err: Error) => {
      console.error("⚠️  Redis client error:", err);
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    await redisClient.connect();
    isRedisEnabled = true;
    console.log(`✅ Redis caching enabled (TTL: ${cacheTTL}s)`);
  } catch (error) {
    console.warn("⚠️  Failed to initialize Redis:", error);
    console.warn("⚠️  Continuing without caching...");
  }
}

/**
 * Get value from cache (returns null if Redis is disabled or key not found)
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (!isRedisEnabled || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

/**
 * Set value in cache (does nothing if Redis is disabled)
 */
export async function cacheSet(key: string, value: any, ttl: number = cacheTTL): Promise<void> {
  if (!isRedisEnabled || !redisClient) {
    return;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error("Cache set error:", error);
  }
}

/**
 * Delete value from cache (does nothing if Redis is disabled)
 */
export async function cacheDel(key: string): Promise<void> {
  if (!isRedisEnabled || !redisClient) {
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}

/**
 * Delete multiple keys matching a pattern (does nothing if Redis is disabled)
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isRedisEnabled || !redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Cache delete pattern error:", error);
  }
}

/**
 * Invalidate cache for a specific profile
 */
export async function invalidateProfileCache(profileId: string): Promise<void> {
  await Promise.all([
    cacheDel(`profile:${profileId}`),
    cacheDel(`profile:${profileId}:links`),
    cacheDel(`profile:${profileId}:theme`),
  ]);
}

/**
 * Invalidate cache for a user's profiles
 */
export async function invalidateUserProfilesCache(userId: string): Promise<void> {
  await cacheDelPattern(`user:${userId}:profiles`);
}

/**
 * Check if Redis is enabled
 */
export function isRedisCacheEnabled(): boolean {
  return isRedisEnabled;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (isRedisEnabled && redisClient) {
    try {
      await redisClient.quit();
      console.log("✅ Redis connection closed");
    } catch (error) {
      console.error("Error closing Redis:", error);
    }
  }
}
