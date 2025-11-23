import { type User, type UpsertUser, type Profile, type SocialLink, type Theme, type InsertProfile, type InsertSocialLink, type UpdateProfile, type UpdateSocialLink, type InsertTheme, type UpdateTheme, type CreateBioPage, type UpdateBioPage, users, profiles, socialLinks, themes } from "@shared/schema";
import { db } from "./db";
import { eq, asc, sql, and, ne, inArray } from "drizzle-orm";
import { getBestProfileImageUrl } from "./gravatar";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserVerificationToken(id: string, token: string | null, expires: Date | null): Promise<void>;
  updateUserPasswordResetToken(id: string, token: string | null, expires: Date | null): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  
  // Profile methods
  getProfile(username: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileByPageName(pageName: string): Promise<Profile | undefined>;
  getProfilesByUserId(userId: string): Promise<Profile[]>;
  getDefaultProfileByUserId(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  createBioPage(userId: string, pageData: CreateBioPage): Promise<Profile>;
  updateProfile(id: string, updates: Partial<UpdateProfile>): Promise<Profile | undefined>;
  updateBioPage(id: string, updates: Partial<UpdateBioPage>): Promise<Profile | undefined>;
  deleteBioPage(id: string, userId: string): Promise<boolean>;
  setDefaultBioPage(id: string, userId: string): Promise<void>;
  incrementProfileViews(id: string): Promise<void>;
  incrementLinkClicks(id: string): Promise<void>;

  // Social links methods
  getSocialLinks(profileId: string): Promise<SocialLink[]>;
  getSocialLink(id: string): Promise<SocialLink | undefined>;
  getSocialLinksByIds(linkIds: string[]): Promise<SocialLink[]>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: string, updates: Partial<UpdateSocialLink>): Promise<SocialLink | undefined>;
  deleteSocialLink(id: string): Promise<boolean>;
  reorderSocialLinks(linkIds: string[]): Promise<void>;
  incrementIndividualLinkClick(linkId: string): Promise<void>;

  // Theme methods
  getActiveTheme(profileId: string): Promise<Theme | undefined>;
  getTheme(id: string): Promise<Theme | undefined>;
  createTheme(theme: InsertTheme): Promise<Theme>;
  updateTheme(id: string, updates: Partial<UpdateTheme>): Promise<Theme | undefined>;
  deleteTheme(id: string): Promise<boolean>;
  activateTheme(themeId: string, profileId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserVerificationToken(id: string, token: string | null, expires: Date | null): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerificationToken: token,
        emailVerificationExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async updateUserPasswordResetToken(id: string, token: string | null, expires: Date | null): Promise<void> {
    await db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  // Profile methods
  async getProfile(username: string): Promise<Profile | undefined> {
    // For backward compatibility, check both username and pageName
    const [profile] = await db.select().from(profiles).where(eq(profiles.pageName, username));
    return profile || undefined;
  }

  async getProfileById(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    // Return the default profile for backward compatibility
    const [profile] = await db.select().from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)));
    return profile || undefined;
  }

  async getProfileByPageName(pageName: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.pageName, pageName));
    return profile || undefined;
  }

  async getProfilesByUserId(userId: string): Promise<Profile[]> {
    return await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(asc(profiles.createdAt));
  }

  async getDefaultProfileByUserId(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)));
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async createBioPage(userId: string, pageData: CreateBioPage): Promise<Profile> {
    // Check if this is the first page for the user
    const existingProfiles = await this.getProfilesByUserId(userId);
    const isFirstPage = existingProfiles.length === 0;

    // Get user email for Gravatar integration
    const user = await this.getUser(userId);
    const userEmail = user?.email;

    // Determine the best profile image URL
    let profileImageUrl = pageData.profileImageUrl;
    if (!profileImageUrl && userEmail) {
      try {
        profileImageUrl = await getBestProfileImageUrl(
          userEmail,
          pageData.profileImageUrl,
          pageData.displayName
        );
      } catch (error) {
        console.warn('Error getting Gravatar URL:', error);
        // Continue with null profileImageUrl if Gravatar fails
      }
    }

    const [profile] = await db
      .insert(profiles)
      .values({
        userId,
        pageName: pageData.pageName,
        displayName: pageData.displayName,
        bio: pageData.bio,
        profileImageUrl: profileImageUrl || null,
        isDefault: isFirstPage, // First page is always default
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return profile;
  }

  async updateProfile(id: string, updates: Partial<UpdateProfile>): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id))
      .returning();
    return profile || undefined;
  }

  async updateBioPage(id: string, updates: Partial<UpdateBioPage>): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id))
      .returning();
    return profile || undefined;
  }

  async deleteBioPage(id: string, userId: string): Promise<boolean> {
    // Check if this is the default page
    const profile = await this.getProfileById(id);
    if (!profile || profile.userId !== userId) {
      return false;
    }

    if (profile.isDefault) {
      // If deleting the default page, make another page the default
      const otherProfiles = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.userId, userId), ne(profiles.id, id)))
        .limit(1);

      if (otherProfiles.length > 0) {
        await db
          .update(profiles)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(profiles.id, otherProfiles[0].id));
      }
    }

    const result = await db
      .delete(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async setDefaultBioPage(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // First, unset all default pages for this user
      await tx
        .update(profiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(profiles.userId, userId));

      // Then set the specified page as default
      const result = await tx
        .update(profiles)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(eq(profiles.id, id), eq(profiles.userId, userId)))
        .returning();

      // Verify that the update actually affected a row
      if (result.length === 0) {
        throw new Error("Profile not found or does not belong to user");
      }
    });
  }

  async incrementProfileViews(id: string): Promise<void> {
    await db
      .update(profiles)
      .set({ profileViews: sql`${profiles.profileViews} + 1` })
      .where(eq(profiles.id, id));
  }

  async incrementLinkClicks(id: string): Promise<void> {
    await db
      .update(profiles)
      .set({ linkClicks: sql`${profiles.linkClicks} + 1` })
      .where(eq(profiles.id, id));
  }

  async getSocialLinks(profileId: string): Promise<SocialLink[]> {
    return await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.profileId, profileId))
      .orderBy(asc(socialLinks.order));
  }

  async getSocialLink(id: string): Promise<SocialLink | undefined> {
    const [link] = await db.select().from(socialLinks).where(eq(socialLinks.id, id));
    return link || undefined;
  }

  async getSocialLinksByIds(linkIds: string[]): Promise<SocialLink[]> {
    if (linkIds.length === 0) {
      return [];
    }
    return await db
      .select()
      .from(socialLinks)
      .where(inArray(socialLinks.id, linkIds));
  }

  async createSocialLink(insertLink: InsertSocialLink): Promise<SocialLink> {
    const [link] = await db
      .insert(socialLinks)
      .values(insertLink)
      .returning();
    return link;
  }

  async updateSocialLink(id: string, updates: Partial<UpdateSocialLink>): Promise<SocialLink | undefined> {
    const [link] = await db
      .update(socialLinks)
      .set(updates)
      .where(eq(socialLinks.id, id))
      .returning();
    return link || undefined;
  }

  async deleteSocialLink(id: string): Promise<boolean> {
    const result = await db
      .delete(socialLinks)
      .where(eq(socialLinks.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderSocialLinks(linkIds: string[]): Promise<void> {
    for (let i = 0; i < linkIds.length; i++) {
      await db
        .update(socialLinks)
        .set({ order: i + 1 })
        .where(eq(socialLinks.id, linkIds[i]));
    }
  }

  async incrementIndividualLinkClick(linkId: string): Promise<void> {
    await db
      .update(socialLinks)
      .set({ clicks: sql`${socialLinks.clicks} + 1` })
      .where(eq(socialLinks.id, linkId));
  }

  // Theme methods
  async getActiveTheme(profileId: string): Promise<Theme | undefined> {
    const [theme] = await db
      .select()
      .from(themes)
      .where(and(eq(themes.profileId, profileId), eq(themes.isActive, true)));
    return theme || undefined;
  }

  async getTheme(id: string): Promise<Theme | undefined> {
    const [theme] = await db.select().from(themes).where(eq(themes.id, id));
    return theme || undefined;
  }

  async createTheme(insertTheme: InsertTheme): Promise<Theme> {
    const [theme] = await db
      .insert(themes)
      .values(insertTheme)
      .returning();
    return theme;
  }

  async updateTheme(id: string, updates: Partial<UpdateTheme>): Promise<Theme | undefined> {
    const [theme] = await db
      .update(themes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, id))
      .returning();
    return theme || undefined;
  }

  async deleteTheme(id: string): Promise<boolean> {
    const result = await db
      .delete(themes)
      .where(eq(themes.id, id))
      .returning();
    return result.length > 0;
  }

  async activateTheme(themeId: string, profileId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // First, deactivate all themes for this profile and update timestamp
      await tx
        .update(themes)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(themes.profileId, profileId));

      // Then activate the selected theme (ensuring it belongs to the profile) and update timestamp
      await tx
        .update(themes)
        .set({ 
          isActive: true,
          updatedAt: new Date()
        })
        .where(and(
          eq(themes.id, themeId),
          eq(themes.profileId, profileId)
        ));
    });
  }
}

export const storage = new DatabaseStorage();
