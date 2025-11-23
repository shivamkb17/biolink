/**
 * Admin-specific API routes
 * Provides endpoints for managing users, profiles, and viewing system analytics
 */

import { type Request, type Response, Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { users, profiles, socialLinks } from "@shared/schema";
import { sql, desc, count, inArray } from "drizzle-orm";

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

    // Get user growth over last 30 days (daily)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allUsers = await db
      .select({
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.createdAt} >= ${thirtyDaysAgo}`)
      .orderBy(users.createdAt);

    // Group by day
    const userGrowth: Record<string, number> = {};
    allUsers.forEach((user) => {
      const date = new Date(user.createdAt!).toISOString().split("T")[0];
      userGrowth[date] = (userGrowth[date] || 0) + 1;
    });

    // Fill in missing days with 0
    const userGrowthData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      userGrowthData.push({
        date: dateStr,
        users: userGrowth[dateStr] || 0,
      });
    }

    // Get profile views and clicks over last 30 days
    const allProfiles = await db
      .select({
        profileViews: profiles.profileViews,
        linkClicks: profiles.linkClicks,
      })
      .from(profiles);

    const totalProfileViews = allProfiles.reduce((sum, p) => sum + (p.profileViews || 0), 0);
    const totalLinkClicks = allProfiles.reduce((sum, p) => sum + (p.linkClicks || 0), 0);

    res.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalProfiles: totalProfiles || 0,
        totalLinks: totalLinks || 0,
        recentUsersCount: recentUsers.length,
        totalProfileViews,
        totalLinkClicks,
      },
      recentUsers,
      topProfiles,
      userGrowth: userGrowthData,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin statistics" });
  }
});

// Get all users with pagination, search, and filtering
router.get("/users", isAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const filterBy = req.query.filterBy as string; // 'all', 'admin', 'verified', 'unverified'
    const sortBy = (req.query.sortBy as string) || "createdAt"; // 'createdAt', 'email', 'name'
    const sortOrder = (req.query.sortOrder as string) || "desc"; // 'asc', 'desc'

    let query = db.select().from(users);

    // Apply search filter
    if (search) {
      query = query.where(
        sql`(${users.email} ILIKE ${`%${search}%`} OR ${users.firstName} ILIKE ${`%${search}%`} OR ${users.lastName} ILIKE ${`%${search}%`})`
      );
    }

    // Apply status filters
    if (filterBy === "admin") {
      query = query.where(sql`${users.isAdmin} = true`);
    } else if (filterBy === "verified") {
      query = query.where(sql`${users.isEmailVerified} = true`);
    } else if (filterBy === "unverified") {
      query = query.where(sql`${users.isEmailVerified} = false`);
    }

    // Apply sorting
    const orderByColumn = 
      sortBy === "email" ? users.email :
      sortBy === "name" ? users.firstName :
      users.createdAt;
    
    if (sortOrder === "asc") {
      query = query.orderBy(orderByColumn);
    } else {
      query = query.orderBy(desc(orderByColumn));
    }

    const allUsers = await query.limit(limit).offset(offset);

    // Get total count with same filters
    let countQuery = db.select({ total: count() }).from(users);
    if (search) {
      countQuery = countQuery.where(
        sql`(${users.email} ILIKE ${`%${search}%`} OR ${users.firstName} ILIKE ${`%${search}%`} OR ${users.lastName} ILIKE ${`%${search}%`})`
      );
    }
    if (filterBy === "admin") {
      countQuery = countQuery.where(sql`${users.isAdmin} = true`);
    } else if (filterBy === "verified") {
      countQuery = countQuery.where(sql`${users.isEmailVerified} = true`);
    } else if (filterBy === "unverified") {
      countQuery = countQuery.where(sql`${users.isEmailVerified} = false`);
    }

    const [{ total }] = await countQuery;

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

// Get all profiles with pagination, search, and filtering
router.get("/profiles", isAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const filterBy = req.query.filterBy as string; // 'all', 'default', 'secondary'
    const sortBy = (req.query.sortBy as string) || "createdAt"; // 'createdAt', 'views', 'clicks', 'pageName'
    const sortOrder = (req.query.sortOrder as string) || "desc"; // 'asc', 'desc'

    let query = db.select().from(profiles);

    // Apply search filter
    if (search) {
      query = query.where(
        sql`(${profiles.pageName} ILIKE ${`%${search}%`} OR ${profiles.displayName} ILIKE ${`%${search}%`} OR ${profiles.bio} ILIKE ${`%${search}%`})`
      );
    }

    // Apply status filters
    if (filterBy === "default") {
      query = query.where(sql`${profiles.isDefault} = true`);
    } else if (filterBy === "secondary") {
      query = query.where(sql`${profiles.isDefault} = false`);
    }

    // Apply sorting
    const orderByColumn = 
      sortBy === "views" ? profiles.profileViews :
      sortBy === "clicks" ? profiles.linkClicks :
      sortBy === "pageName" ? profiles.pageName :
      profiles.createdAt;
    
    if (sortOrder === "asc") {
      query = query.orderBy(orderByColumn);
    } else {
      query = query.orderBy(desc(orderByColumn));
    }

    const allProfiles = await query.limit(limit).offset(offset);

    // Get total count with same filters
    let countQuery = db.select({ total: count() }).from(profiles);
    if (search) {
      countQuery = countQuery.where(
        sql`(${profiles.pageName} ILIKE ${`%${search}%`} OR ${profiles.displayName} ILIKE ${`%${search}%`} OR ${profiles.bio} ILIKE ${`%${search}%`})`
      );
    }
    if (filterBy === "default") {
      countQuery = countQuery.where(sql`${profiles.isDefault} = true`);
    } else if (filterBy === "secondary") {
      countQuery = countQuery.where(sql`${profiles.isDefault} = false`);
    }

    const [{ total }] = await countQuery;

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

// Bulk delete users
router.post("/users/bulk-delete", isAdmin, async (req: any, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds must be a non-empty array" });
    }

    // Don't allow deleting yourself
    if (userIds.includes(req.user.id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Delete users' profiles first (cascading)
    await db.delete(profiles).where(inArray(profiles.userId, userIds));

    // Delete users
    await db.delete(users).where(inArray(users.id, userIds));

    res.json({ message: `${userIds.length} user(s) deleted successfully` });
  } catch (error) {
    console.error("Admin bulk delete users error:", error);
    res.status(500).json({ error: "Failed to delete users" });
  }
});

// Bulk toggle admin status
router.post("/users/bulk-admin", isAdmin, async (req: any, res: Response) => {
  try {
    const { userIds, isAdmin: newAdminStatus } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds must be a non-empty array" });
    }

    if (typeof newAdminStatus !== "boolean") {
      return res.status(400).json({ error: "isAdmin must be a boolean" });
    }

    // Don't allow removing your own admin status
    if (userIds.includes(req.user.id) && !newAdminStatus) {
      return res.status(400).json({ error: "Cannot remove your own admin status" });
    }

    // Update all users
    for (const userId of userIds) {
      await storage.updateUser(userId, { isAdmin: newAdminStatus });
    }

    res.json({ message: `${userIds.length} user(s) updated successfully` });
  } catch (error) {
    console.error("Admin bulk toggle admin error:", error);
    res.status(500).json({ error: "Failed to update users" });
  }
});

// Export users to CSV
router.get("/users/export", isAdmin, async (req: any, res: Response) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    // Generate CSV
    const csvHeader = "ID,Email,First Name,Last Name,Email Verified,Admin,Created At\n";
    const csvRows = allUsers.map(u => 
      `${u.id},${u.email || ""},${u.firstName || ""},${u.lastName || ""},${u.isEmailVerified ? "Yes" : "No"},${u.isAdmin ? "Yes" : "No"},${u.createdAt?.toISOString() || ""}\n`
    ).join("");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=users-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error("Admin export users error:", error);
    res.status(500).json({ error: "Failed to export users" });
  }
});

// Export profiles to CSV
router.get("/profiles/export", isAdmin, async (req: any, res: Response) => {
  try {
    const allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));

    // Generate CSV
    const csvHeader = "ID,User ID,Page Name,Display Name,Bio,Profile Views,Link Clicks,Is Default,Created At\n";
    const csvRows = allProfiles.map(p => 
      `${p.id},${p.userId},${p.pageName || ""},${p.displayName || ""},"${(p.bio || "").replace(/"/g, '""')}",${p.profileViews || 0},${p.linkClicks || 0},${p.isDefault ? "Yes" : "No"},${p.createdAt?.toISOString() || ""}\n`
    ).join("");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=profiles-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error("Admin export profiles error:", error);
    res.status(500).json({ error: "Failed to export profiles" });
  }
});

// Get activity logs (placeholder - would need activity_logs table)
router.get("/activity", isAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Placeholder - in a real implementation, you'd query an activity_logs table
    res.json({
      activities: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    console.error("Admin activity logs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

// Get system health/stats
router.get("/system/health", isAdmin, async (req: any, res: Response) => {
  try {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ totalProfiles }] = await db.select({ totalProfiles: count() }).from(profiles);
    const [{ totalLinks }] = await db.select({ totalLinks: count() }).from(socialLinks);
    
    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentUsers = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${oneDayAgo}`);
    
    const recentProfiles = await db
      .select({ count: count() })
      .from(profiles)
      .where(sql`${profiles.createdAt} >= ${oneDayAgo}`);

    res.json({
      totalUsers: totalUsers || 0,
      totalProfiles: totalProfiles || 0,
      totalLinks: totalLinks || 0,
      recentUsers24h: recentUsers[0]?.count || 0,
      recentProfiles24h: recentProfiles[0]?.count || 0,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin system health error:", error);
    res.status(500).json({ error: "Failed to fetch system health" });
  }
});

// User impersonation (for support)
router.post("/users/:id/impersonate", isAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const user = await storage.getUser(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Store original admin ID in session for restoration
    req.session.originalAdminId = req.user.id;
    req.session.userId = id;
    req.session.isImpersonating = true;

    res.json({
      message: "Impersonation started",
      user: {
        ...user,
        password: undefined,
      },
    });
  } catch (error) {
    console.error("Admin impersonate error:", error);
    res.status(500).json({ error: "Failed to impersonate user" });
  }
});

// Stop impersonation
router.post("/users/stop-impersonate", isAdmin, async (req: any, res: Response) => {
  try {
    if (req.session.isImpersonating && req.session.originalAdminId) {
      req.session.userId = req.session.originalAdminId;
      delete req.session.isImpersonating;
      delete req.session.originalAdminId;
    }

    res.json({ message: "Impersonation stopped" });
  } catch (error) {
    console.error("Admin stop impersonate error:", error);
    res.status(500).json({ error: "Failed to stop impersonation" });
  }
});

export default router;
