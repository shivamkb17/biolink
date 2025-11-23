import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { storage } from '../storage';
import { pool } from '../db';
import type { User, Profile, SocialLink, Theme } from '@shared/schema';

/**
 * Storage Layer Integration Tests
 *
 * These tests verify the database operations work correctly.
 * They use a real database connection and clean up after themselves.
 */

// Test data
let testUser: User;
let testProfile: Profile;
let testLink: SocialLink;
let testTheme: Theme;

// Clean up function to remove test data
async function cleanupTestData() {
  try {
    // Clean up in reverse order of dependencies
    if (testTheme?.id) {
      await storage.deleteTheme(testTheme.id);
    }
    if (testLink?.id) {
      await storage.deleteSocialLink(testLink.id);
    }
    if (testProfile?.id) {
      await storage.deleteBioPage(testProfile.id, testUser?.id);
    }
    if (testUser?.id) {
      // Delete user via direct DB query since there's no delete method
      const client = await pool.connect();
      await client.query('DELETE FROM users WHERE id = $1', [testUser.id]);
      client.release();
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

beforeEach(async () => {
  // Clean up before each test to ensure clean state
  await cleanupTestData();
});

afterAll(async () => {
  // Clean up after all tests
  await cleanupTestData();
  await pool.end();
});

describe('User Storage Operations', () => {
  it('should create a new user', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: false,
    };

    testUser = await storage.createUser(userData);

    expect(testUser).toBeDefined();
    expect(testUser.id).toBeDefined();
    expect(testUser.email).toBe(userData.email);
    expect(testUser.firstName).toBe(userData.firstName);
    expect(testUser.lastName).toBe(userData.lastName);
  });

  it('should get user by id', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const retrievedUser = await storage.getUser(testUser.id);

    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.id).toBe(testUser.id);
    expect(retrievedUser?.email).toBe(userData.email);
  });

  it('should get user by email', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const retrievedUser = await storage.getUserByEmail(userData.email);

    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.email).toBe(userData.email);
  });

  it('should update user data', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const updatedUser = await storage.updateUser(testUser.id, {
      firstName: 'Updated',
      lastName: 'Name',
    });

    expect(updatedUser).toBeDefined();
    expect(updatedUser?.firstName).toBe('Updated');
    expect(updatedUser?.lastName).toBe('Name');
  });

  it('should set and get verification token', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const token = 'test-verification-token';
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await storage.updateUserVerificationToken(testUser.id, token, expires);

    const userByToken = await storage.getUserByVerificationToken(token);

    expect(userByToken).toBeDefined();
    expect(userByToken?.id).toBe(testUser.id);
    expect(userByToken?.emailVerificationToken).toBe(token);
  });

  it('should set and get password reset token', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const token = 'test-reset-token';
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await storage.updateUserPasswordResetToken(testUser.id, token, expires);

    const userByToken = await storage.getUserByPasswordResetToken(token);

    expect(userByToken).toBeDefined();
    expect(userByToken?.id).toBe(testUser.id);
    expect(userByToken?.passwordResetToken).toBe(token);
  });
});

describe('Profile Storage Operations', () => {
  beforeEach(async () => {
    // Create a test user before each profile test
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);
  });

  it('should create a bio page', async () => {
    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };

    testProfile = await storage.createBioPage(testUser.id, pageData);

    expect(testProfile).toBeDefined();
    expect(testProfile.id).toBeDefined();
    expect(testProfile.userId).toBe(testUser.id);
    expect(testProfile.pageName).toBe(pageData.pageName);
    expect(testProfile.displayName).toBe(pageData.displayName);
    expect(testProfile.bio).toBe(pageData.bio);
  });

  it('should get profile by page name', async () => {
    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);

    const retrievedProfile = await storage.getProfileByPageName(pageData.pageName);

    expect(retrievedProfile).toBeDefined();
    expect(retrievedProfile?.pageName).toBe(pageData.pageName);
  });

  it('should get profile by id', async () => {
    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);

    const retrievedProfile = await storage.getProfileById(testProfile.id);

    expect(retrievedProfile).toBeDefined();
    expect(retrievedProfile?.id).toBe(testProfile.id);
  });

  it('should get all profiles by user id', async () => {
    const pageData1 = {
      pageName: `testpage1-${Date.now()}`,
      displayName: 'Test Page 1',
      bio: 'This is test bio 1',
    };
    const pageData2 = {
      pageName: `testpage2-${Date.now()}`,
      displayName: 'Test Page 2',
      bio: 'This is test bio 2',
    };

    const profile1 = await storage.createBioPage(testUser.id, pageData1);
    const profile2 = await storage.createBioPage(testUser.id, pageData2);
    testProfile = profile1; // For cleanup

    const profiles = await storage.getProfilesByUserId(testUser.id);

    expect(profiles).toBeDefined();
    expect(profiles.length).toBeGreaterThanOrEqual(2);

    // Cleanup the second profile
    await storage.deleteBioPage(profile2.id, testUser.id);
  });

  it('should update bio page', async () => {
    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);

    const updatedProfile = await storage.updateBioPage(testProfile.id, {
      displayName: 'Updated Display Name',
      bio: 'Updated bio',
    });

    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.displayName).toBe('Updated Display Name');
    expect(updatedProfile?.bio).toBe('Updated bio');
  });

  it('should set default bio page', async () => {
    const pageData1 = {
      pageName: `testpage1-${Date.now()}`,
      displayName: 'Test Page 1',
      bio: 'This is test bio 1',
    };
    const pageData2 = {
      pageName: `testpage2-${Date.now()}`,
      displayName: 'Test Page 2',
      bio: 'This is test bio 2',
    };

    const profile1 = await storage.createBioPage(testUser.id, pageData1);
    const profile2 = await storage.createBioPage(testUser.id, pageData2);
    testProfile = profile1;

    await storage.setDefaultBioPage(profile2.id, testUser.id);

    const defaultProfile = await storage.getDefaultProfileByUserId(testUser.id);

    expect(defaultProfile).toBeDefined();
    expect(defaultProfile?.id).toBe(profile2.id);

    // Cleanup
    await storage.deleteBioPage(profile2.id, testUser.id);
  });

  it('should increment profile views', async () => {
    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);

    const initialViews = testProfile.profileViews || 0;

    await storage.incrementProfileViews(testProfile.id);

    const updatedProfile = await storage.getProfileById(testProfile.id);

    expect(updatedProfile?.profileViews).toBe(initialViews + 1);
  });
});

describe('Social Links Storage Operations', () => {
  beforeEach(async () => {
    // Create test user and profile
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);
  });

  it('should create a social link', async () => {
    const linkData = {
      profileId: testProfile.id,
      platform: 'twitter',
      title: 'Twitter Profile',
      url: 'https://twitter.com/testuser',
      order: 0,
    };

    testLink = await storage.createSocialLink(linkData);

    expect(testLink).toBeDefined();
    expect(testLink.id).toBeDefined();
    expect(testLink.profileId).toBe(testProfile.id);
    expect(testLink.platform).toBe(linkData.platform);
    expect(testLink.url).toBe(linkData.url);
  });

  it('should get social links by profile id', async () => {
    const linkData = {
      profileId: testProfile.id,
      platform: 'twitter',
      title: 'Twitter Profile',
      url: 'https://twitter.com/testuser',
      order: 0,
    };
    testLink = await storage.createSocialLink(linkData);

    const links = await storage.getSocialLinks(testProfile.id);

    expect(links).toBeDefined();
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].profileId).toBe(testProfile.id);
  });

  it('should update a social link', async () => {
    const linkData = {
      profileId: testProfile.id,
      platform: 'twitter',
      title: 'Twitter Profile',
      url: 'https://twitter.com/testuser',
      order: 0,
    };
    testLink = await storage.createSocialLink(linkData);

    const updatedLink = await storage.updateSocialLink(testLink.id, {
      title: 'Updated Twitter',
      url: 'https://twitter.com/updateduser',
    });

    expect(updatedLink).toBeDefined();
    expect(updatedLink?.title).toBe('Updated Twitter');
    expect(updatedLink?.url).toBe('https://twitter.com/updateduser');
  });

  it('should increment link clicks', async () => {
    const linkData = {
      profileId: testProfile.id,
      platform: 'twitter',
      title: 'Twitter Profile',
      url: 'https://twitter.com/testuser',
      order: 0,
    };
    testLink = await storage.createSocialLink(linkData);

    const initialClicks = testLink.clicks || 0;

    await storage.incrementIndividualLinkClick(testLink.id);

    const updatedLink = await storage.getSocialLink(testLink.id);

    expect(updatedLink?.clicks).toBe(initialClicks + 1);
  });

  it('should delete a social link', async () => {
    const linkData = {
      profileId: testProfile.id,
      platform: 'twitter',
      title: 'Twitter Profile',
      url: 'https://twitter.com/testuser',
      order: 0,
    };
    testLink = await storage.createSocialLink(linkData);

    const deleted = await storage.deleteSocialLink(testLink.id);

    expect(deleted).toBe(true);

    const retrievedLink = await storage.getSocialLink(testLink.id);
    expect(retrievedLink).toBeUndefined();
  });
});

describe('Theme Storage Operations', () => {
  beforeEach(async () => {
    // Create test user and profile
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    };
    testUser = await storage.createUser(userData);

    const pageData = {
      pageName: `testpage-${Date.now()}`,
      displayName: 'Test Page',
      bio: 'This is a test bio',
    };
    testProfile = await storage.createBioPage(testUser.id, pageData);
  });

  it('should create a theme', async () => {
    const themeData = {
      profileId: testProfile.id,
      name: 'Test Theme',
      colors: {
        primary: '#000000',
        primaryForeground: '#ffffff',
        secondary: '#cccccc',
        secondaryForeground: '#000000',
        accent: '#ff0000',
        accentForeground: '#ffffff',
        background: '#ffffff',
        foreground: '#000000',
        card: '#f5f5f5',
        cardForeground: '#000000',
        muted: '#e0e0e0',
        mutedForeground: '#666666',
        border: '#dddddd',
        input: '#ffffff',
        ring: '#000000',
      },
      gradients: {
        background: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        card: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        button: { enabled: false, start: '#000000', end: '#333333', angle: 90 },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        display: 'Inter',
        headingColor: '#000000',
        bodyColor: '#000000',
        displayColor: '#000000',
      },
      layout: {
        borderRadius: 8,
        cardStyle: 'elevated' as const,
        spacing: 'normal' as const,
        shadowIntensity: 2,
      },
    };

    testTheme = await storage.createTheme(themeData);

    expect(testTheme).toBeDefined();
    expect(testTheme.id).toBeDefined();
    expect(testTheme.profileId).toBe(testProfile.id);
    expect(testTheme.name).toBe(themeData.name);
  });

  it('should activate a theme', async () => {
    const themeData = {
      profileId: testProfile.id,
      name: 'Test Theme',
      colors: {
        primary: '#000000',
        primaryForeground: '#ffffff',
        secondary: '#cccccc',
        secondaryForeground: '#000000',
        accent: '#ff0000',
        accentForeground: '#ffffff',
        background: '#ffffff',
        foreground: '#000000',
        card: '#f5f5f5',
        cardForeground: '#000000',
        muted: '#e0e0e0',
        mutedForeground: '#666666',
        border: '#dddddd',
        input: '#ffffff',
        ring: '#000000',
      },
      gradients: {
        background: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        card: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        button: { enabled: false, start: '#000000', end: '#333333', angle: 90 },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        display: 'Inter',
        headingColor: '#000000',
        bodyColor: '#000000',
        displayColor: '#000000',
      },
      layout: {
        borderRadius: 8,
        cardStyle: 'elevated' as const,
        spacing: 'normal' as const,
        shadowIntensity: 2,
      },
    };
    testTheme = await storage.createTheme(themeData);

    await storage.activateTheme(testTheme.id, testProfile.id);

    const activeTheme = await storage.getActiveTheme(testProfile.id);

    expect(activeTheme).toBeDefined();
    expect(activeTheme?.id).toBe(testTheme.id);
    expect(activeTheme?.isActive).toBe(true);
  });

  it('should get theme by id', async () => {
    const themeData = {
      profileId: testProfile.id,
      name: 'Test Theme',
      colors: {
        primary: '#000000',
        primaryForeground: '#ffffff',
        secondary: '#cccccc',
        secondaryForeground: '#000000',
        accent: '#ff0000',
        accentForeground: '#ffffff',
        background: '#ffffff',
        foreground: '#000000',
        card: '#f5f5f5',
        cardForeground: '#000000',
        muted: '#e0e0e0',
        mutedForeground: '#666666',
        border: '#dddddd',
        input: '#ffffff',
        ring: '#000000',
      },
      gradients: {
        background: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        card: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        button: { enabled: false, start: '#000000', end: '#333333', angle: 90 },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        display: 'Inter',
        headingColor: '#000000',
        bodyColor: '#000000',
        displayColor: '#000000',
      },
      layout: {
        borderRadius: 8,
        cardStyle: 'elevated' as const,
        spacing: 'normal' as const,
        shadowIntensity: 2,
      },
    };
    testTheme = await storage.createTheme(themeData);

    const retrievedTheme = await storage.getTheme(testTheme.id);

    expect(retrievedTheme).toBeDefined();
    expect(retrievedTheme?.id).toBe(testTheme.id);
  });

  it('should delete a theme', async () => {
    const themeData = {
      profileId: testProfile.id,
      name: 'Test Theme',
      colors: {
        primary: '#000000',
        primaryForeground: '#ffffff',
        secondary: '#cccccc',
        secondaryForeground: '#000000',
        accent: '#ff0000',
        accentForeground: '#ffffff',
        background: '#ffffff',
        foreground: '#000000',
        card: '#f5f5f5',
        cardForeground: '#000000',
        muted: '#e0e0e0',
        mutedForeground: '#666666',
        border: '#dddddd',
        input: '#ffffff',
        ring: '#000000',
      },
      gradients: {
        background: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        card: { enabled: false, start: '#ffffff', end: '#f0f0f0', angle: 90 },
        button: { enabled: false, start: '#000000', end: '#333333', angle: 90 },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        display: 'Inter',
        headingColor: '#000000',
        bodyColor: '#000000',
        displayColor: '#000000',
      },
      layout: {
        borderRadius: 8,
        cardStyle: 'elevated' as const,
        spacing: 'normal' as const,
        shadowIntensity: 2,
      },
    };
    testTheme = await storage.createTheme(themeData);

    const deleted = await storage.deleteTheme(testTheme.id);

    expect(deleted).toBe(true);

    const retrievedTheme = await storage.getTheme(testTheme.id);
    expect(retrievedTheme).toBeUndefined();
  });
});
