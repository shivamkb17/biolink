import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // Hashed password for email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  pageName: text("page_name").notNull().unique(), // Unique name for the page (e.g., "personal", "business")
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull(),
  profileImageUrl: text("profile_image_url"),
  profileViews: integer("profile_views").default(0),
  linkClicks: integer("link_clicks").default(0),
  isDefault: boolean("is_default").default(false), // One page per user should be default
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Index on userId + pageName combination for efficient queries
  index("IDX_user_page_name").on(table.userId, table.pageName),
]);

export const socialLinks = pgTable("social_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  clicks: integer("clicks").default(0),
});

export const themes = pgTable("themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull().references(() => profiles.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false),
  colors: jsonb("colors").notNull(),
  gradients: jsonb("gradients").notNull(),
  fonts: jsonb("fonts").notNull(),
  layout: jsonb("layout").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  profileViews: true,
  linkClicks: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialLinkSchema = createInsertSchema(socialLinks).omit({
  id: true,
});

export const updateProfileSchema = insertProfileSchema.partial().extend({
  id: z.string(),
});

// Schema for creating a new bio page
export const createBioPageSchema = z.object({
  pageName: z.string().min(1, "Page name is required").max(50, "Page name must be less than 50 characters")
    .regex(/^[a-zA-Z0-9-_]+$/, "Page name can only contain letters, numbers, hyphens, and underscores"),
  displayName: z.string().min(1, "Display name is required").max(100, "Display name must be less than 100 characters"),
  bio: z.string().min(1, "Bio is required").max(500, "Bio must be less than 500 characters"),
  profileImageUrl: z.string().url().optional().or(z.literal("")),
});

// Schema for updating bio page
export const updateBioPageSchema = createBioPageSchema.partial();

export const updateSocialLinkSchema = insertSocialLinkSchema.partial().extend({
  id: z.string(),
});

export const reorderLinksSchema = z.object({
  linkIds: z.array(z.string()),
});

// Theme schemas
export const themeColorsSchema = z.object({
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
});

export const themeGradientsSchema = z.object({
  background: z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    angle: z.number(),
  }),
  card: z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    angle: z.number(),
  }),
  button: z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    angle: z.number(),
  }),
});

export const themeFontsSchema = z.object({
  heading: z.string(),
  body: z.string(),
  display: z.string(),
  headingColor: z.string(),
  bodyColor: z.string(),
  displayColor: z.string(),
});

export const themeLayoutSchema = z.object({
  borderRadius: z.number(),
  cardStyle: z.enum(["elevated", "flat", "outlined"]),
  spacing: z.enum(["compact", "normal", "spacious"]),
  shadowIntensity: z.number(),
});

export const insertThemeSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  colors: themeColorsSchema,
  gradients: themeGradientsSchema,
  fonts: themeFontsSchema,
  layout: themeLayoutSchema,
});

export const updateThemeSchema = insertThemeSchema.partial().extend({
  id: z.string(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdateSocialLink = z.infer<typeof updateSocialLinkSchema>;
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type UpdateTheme = z.infer<typeof updateThemeSchema>;
export type ThemeColors = z.infer<typeof themeColorsSchema>;
export type ThemeGradients = z.infer<typeof themeGradientsSchema>;
export type ThemeFonts = z.infer<typeof themeFontsSchema>;
export type ThemeLayout = z.infer<typeof themeLayoutSchema>;
export type CreateBioPage = z.infer<typeof createBioPageSchema>;
export type UpdateBioPage = z.infer<typeof updateBioPageSchema>;
