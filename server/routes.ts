import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import authRoutes from "./auth";
import { pool } from "./db";
import { 
  insertProfileSchema, 
  insertSocialLinkSchema, 
  updateProfileSchema, 
  updateSocialLinkSchema,
  reorderLinksSchema,
  insertThemeSchema,
  updateThemeSchema,
  createBioPageSchema,
  updateBioPageSchema,
  type Theme
} from "@shared/schema";
import { presetThemes } from "./presetThemes";
import { z } from "zod";


// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: false,
  ttl: sessionTtl,
  tableName: "sessions",
});

// Validate session secret in production
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.error("FATAL ERROR: SESSION_SECRET environment variable is required in production");
  process.exit(1);
}

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS !== "false",
    sameSite: 'lax',
    maxAge: sessionTtl,
    // Add domain configuration for production
    ...(process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN && {
      domain: process.env.COOKIE_DOMAIN
    }),
  },
});

// Authentication middleware for email/password sessions
const isAuthenticated = async (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment monitoring and load balancers
  app.get('/health', async (req, res) => {
    try {
      // Check database connectivity
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: 'Database connection failed',
      });
    }
  });

  // Setup session middleware
  app.use(sessionMiddleware);

  // Email/password auth routes
  app.use('/api/auth', authRoutes);

  // Get current user (email/password auth)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Include profile information with user
      const profile = await storage.getProfileByUserId(user.id);
      res.json({ ...user, profile });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  // Get profile by page name (public)
  app.get("/api/profile/:pageName", async (req, res) => {
    try {
      const { pageName } = req.params;
      const profile = await storage.getProfileByPageName(pageName);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Increment profile views
      await storage.incrementProfileViews(profile.id);
      
      const links = await storage.getSocialLinks(profile.id);
      
      res.json({ profile, links });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all bio pages for authenticated user
  app.get("/api/bio-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pages = await storage.getProfilesByUserId(userId);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new bio page
  app.post("/api/bio-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pageData = createBioPageSchema.parse(req.body);
      
      // Check if page name already exists globally
      const existingProfile = await storage.getProfileByPageName(pageData.pageName);
      if (existingProfile) {
        return res.status(409).json({ message: "Page name already exists" });
      }
      
      const profile = await storage.createBioPage(userId, pageData);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update bio page
  app.patch("/api/bio-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingProfile = await storage.getProfileById(id);
      if (!existingProfile) {
        return res.status(404).json({ message: "Bio page not found" });
      }
      
      if (existingProfile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only edit your own bio pages" });
      }
      
      // Validate the ID parameter
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Invalid bio page ID" });
      }
      
      const updates = updateBioPageSchema.parse(req.body);
      
      // If updating page name, check if it's available
      if (updates.pageName && updates.pageName !== existingProfile.pageName) {
        const existingProfileWithName = await storage.getProfileByPageName(updates.pageName);
        if (existingProfileWithName) {
          return res.status(409).json({ message: "Page name already exists" });
        }
      }
      
      const profile = await storage.updateBioPage(id, updates);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete bio page
  app.delete("/api/bio-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const deleted = await storage.deleteBioPage(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Bio page not found or you don't have permission to delete it" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set default bio page
  app.post("/api/bio-pages/:id/set-default", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingProfile = await storage.getProfileById(id);
      if (!existingProfile) {
        return res.status(404).json({ message: "Bio page not found" });
      }
      
      if (existingProfile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only set your own bio pages as default" });
      }
      
      await storage.setDefaultBioPage(id, userId);
      res.json({ message: "Default bio page updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update profile (protected)
  app.patch("/api/profile/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingProfile = await storage.getProfileById(id);
      if (!existingProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      if (existingProfile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only edit your own profile" });
      }
      
      const updates = updateProfileSchema.parse({ id, ...req.body });
      const profile = await storage.updateProfile(id, updates);
      
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create social link (protected)
  app.post("/api/links", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const linkData = insertSocialLinkSchema.parse(req.body);
      
      // Check ownership of the profile
      const profile = await storage.getProfileById(linkData.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only add links to your own profile" });
      }
      
      const link = await storage.createSocialLink(linkData);
      res.status(201).json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update social link (protected)
  app.patch("/api/links/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingLink = await storage.getSocialLink(id);
      if (!existingLink) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const profile = await storage.getProfileById(existingLink.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only edit your own links" });
      }
      
      const updates = updateSocialLinkSchema.parse({ id, ...req.body });
      const link = await storage.updateSocialLink(id, updates);
      
      res.json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete social link (protected)
  app.delete("/api/links/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingLink = await storage.getSocialLink(id);
      if (!existingLink) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const profile = await storage.getProfileById(existingLink.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only delete your own links" });
      }
      
      const deleted = await storage.deleteSocialLink(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reorder social links (protected)
  app.patch("/api/links/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { linkIds } = reorderLinksSchema.parse(req.body);
      
      // Check ownership of ALL links (not just the first one!)
      if (linkIds.length > 0) {
        for (const linkId of linkIds) {
          const link = await storage.getSocialLink(linkId);
          if (!link) {
            return res.status(404).json({ message: `Link ${linkId} not found` });
          }
          
          const profile = await storage.getProfileById(link.profileId);
          if (!profile || profile.userId !== userId) {
            return res.status(403).json({ message: "Forbidden: You can only reorder your own links" });
          }
        }
      }
      
      await storage.reorderSocialLinks(linkIds);
      res.status(200).json({ message: "Links reordered successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track link click
  app.post("/api/links/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      const link = await storage.getSocialLink(id);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }

      // Increment link clicks for the profile and individual link
      await storage.incrementLinkClicks(link.profileId);
      await storage.incrementIndividualLinkClick(id);
      
      res.json({ url: link.url });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Theme routes

  // Get active theme for a profile
  app.get("/api/themes/:profileId", async (req, res) => {
    try {
      const { profileId } = req.params;
      const theme = await storage.getActiveTheme(profileId);
      
      if (!theme) {
        // Construct a full Theme object from preset theme data
        const presetTheme = presetThemes[0];
        const defaultTheme: Theme = {
          id: randomUUID(),
          profileId: profileId,
          name: presetTheme.name,
          isActive: false, // Not an active custom theme, just a fallback
          colors: presetTheme.colors,
          gradients: presetTheme.gradients,
          fonts: presetTheme.fonts,
          layout: presetTheme.layout,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return res.json(defaultTheme);
      }
      
      res.json(theme);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get preset themes
  app.get("/api/themes/presets", async (req, res) => {
    try {
      
      if (!Array.isArray(presetThemes)) {
        console.error('presetThemes is not an array:', presetThemes);
        return res.status(500).json({ message: "Preset themes not loaded correctly" });
      }
      
      // Return preset themes with proper structure for the frontend
      const formattedPresets = presetThemes.map((preset, index) => ({
        id: `preset-${index}`,
        name: preset.name,
        colors: preset.colors,
        gradients: preset.gradients,
        fonts: preset.fonts,
        layout: preset.layout,
        isPreset: true,
      }));
      res.json(formattedPresets);
    } catch (error) {
      console.error('Error fetching preset themes:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new theme (protected)
  app.post("/api/themes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const themeData = insertThemeSchema.parse(req.body);
      
      // Check ownership of the profile
      const profile = await storage.getProfileById(themeData.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only create themes for your own profile" });
      }
      
      const theme = await storage.createTheme(themeData);
      res.status(201).json(theme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update theme (protected)
  app.patch("/api/themes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingTheme = await storage.getTheme(id);
      if (!existingTheme) {
        return res.status(404).json({ message: "Theme not found" });
      }
      
      const profile = await storage.getProfileById(existingTheme.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only edit your own themes" });
      }
      
      const updates = updateThemeSchema.parse({ id, ...req.body });
      const theme = await storage.updateTheme(id, updates);
      
      res.json(theme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete theme (protected)
  app.delete("/api/themes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingTheme = await storage.getTheme(id);
      if (!existingTheme) {
        return res.status(404).json({ message: "Theme not found" });
      }
      
      const profile = await storage.getProfileById(existingTheme.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only delete your own themes" });
      }
      
      await storage.deleteTheme(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activate theme (protected)
  app.post("/api/themes/:id/activate", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const existingTheme = await storage.getTheme(id);
      if (!existingTheme) {
        return res.status(404).json({ message: "Theme not found" });
      }
      
      const profile = await storage.getProfileById(existingTheme.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only activate your own themes" });
      }
      
      await storage.activateTheme(id, existingTheme.profileId);
      res.json({ message: "Theme activated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get analytics data
  app.get("/api/analytics/:profileId", async (req, res) => {
    try {
      const { profileId } = req.params;
      const profile = await storage.getProfileById(profileId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const links = await storage.getSocialLinks(profileId);
      
      res.json({
        profile: {
          views: profile.profileViews || 0,
          totalClicks: profile.linkClicks || 0,
        },
        links: links.map(link => ({
          id: link.id,
          title: link.title,
          platform: link.platform,
          clicks: link.clicks || 0,
          url: link.url,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}