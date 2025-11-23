/**
 * Admin-specific API routes
 * Provides endpoints for managing users, profiles, and viewing system analytics
 */

import { type Request, type Response, Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { users, profiles, socialLinks } from "@shared/schema";
import { sql, desc, count } from "drizzle-orm";

const router = Router();

/**
 * Admin middleware - Verify user is authenticated AND is an admin
 */
export const isAdmin = async (req: any, res: Response, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (!user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  req.user = user;
  next();
};

// Get admin dashboard overview statistics
router.get("/stats", isAdmin, async (req: any, res: Response) => {
  try {
    // Get total users count
    const [{ totalUsers }] = await db
      .select({ totalUsers: count() })
      .from(users);

    // Get total profiles count
    const [{ totalProfiles }] = await db
      .select({ totalProfiles: count() })
      .from(profiles);

    // Get total links count
    const [{ totalLinks }] = await db
      .select({ totalLinks: count() })
      .from(socialLinks);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await db
      .select()
      .from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`)
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Get top profiles by views
    const topProfiles = await db
      .select()
      .from(profiles)
      .orderBy(desc(profiles.profileViews))
      .limit(10);

    res.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalProfiles: totalProfiles || 0,
        totalLinks: totalLinks || 0,
        recentUsersCount: recentUsers.length,
      },
      recentUsers,
      topProfiles,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin statistics" });
  }
});

// Get all users with pagination
router.get("/users", isAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(users);

    res.json({
      users: allUsers.map(u => ({
        ...u,
        password: undefined, // Never send password hashes to client
      })),
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get all profiles with pagination
router.get("/profiles", isAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const allProfiles = await db
      .select()
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(profiles);

    res.json({
      profiles: allProfiles,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Admin profiles error:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// Delete user (admin only)
router.delete("/users/:id", isAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Delete user's profiles first (cascading)
    await db.delete(profiles).where(sql`${profiles.userId} = ${id}`);

    // Delete user
    await db.delete(users).where(sql`${users.id} = ${id}`);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Toggle user admin status
router.patch("/users/:id/admin", isAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { isAdmin: newAdminStatus } = req.body;

    if (typeof newAdminStatus !== "boolean") {
      return res.status(400).json({ error: "isAdmin must be a boolean" });
    }

    // Don't allow removing your own admin status
    if (id === req.user.id && !newAdminStatus) {
      return res.status(400).json({ error: "Cannot remove your own admin status" });
    }

    const updatedUser = await storage.updateUser(id, { isAdmin: newAdminStatus });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      ...updatedUser,
      password: undefined,
    });
  } catch (error) {
    console.error("Admin toggle admin error:", error);
    res.status(500).json({ error: "Failed to update user admin status" });
  }
});

export default router;
