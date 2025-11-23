import { type Request, type Response, Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./email";
import { authLimiter, emailLimiter } from "./rateLimiter";

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const router = Router();

/**
 * Create a cryptographically secure random hex token.
 *
 * @returns A 64-character hexadecimal string produced from 32 bytes of cryptographic randomness
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Produces a bcrypt hash of the provided plaintext password.
 *
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash of `password`
 */
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Check whether a plaintext password matches a bcrypt password hash.
 *
 * @param password - The plaintext password to verify
 * @param hashedPassword - The bcrypt-generated hashed password to compare against
 * @returns `true` if the plaintext password matches the hash, `false` otherwise
 */
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Register new user with email/password
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await storage.createUser({
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.json({
      message: "Registration successful! Please check your email to verify your account.",
      userId: user.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login with email/password
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        error: "Please verify your email before logging in",
        needsVerification: true 
      });
    }

    // Set user session
    if (req.session) {
      req.session.userId = user.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }

        res.json({
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      });
    } else {
      res.status(500).json({ error: "Session not available" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Verify email
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid verification token" });
    }

    // Find user by verification token
    const user = await storage.getUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    // Check if token is expired
    
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: "Verification token has expired" });
    }

    // Get or create profile BEFORE clearing the token
    let profile = await storage.getDefaultProfileByUserId(user.id);
    if (!profile) {
      // Generate unique pageName from email
      let basePageName = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9-_]/g, "");
      let pageName = basePageName;
      let counter = 1;
      
      // Ensure pageName is unique
      while (await storage.getProfileByPageName(pageName)) {
        pageName = `${basePageName}${counter}`;
        counter++;
      }
      
      const displayName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.email.split("@")[0];

      console.log("Creating profile for user:", user.id, "with pageName:", pageName);
      
      // Ensure pageName is not null or empty
      if (!pageName || pageName.trim() === '') {
        pageName = `user${user.id.slice(-8)}`;
      }
      
      try {
        profile = await storage.createBioPage(user.id, {
          pageName,
          displayName,
          bio: "Welcome to my LinkBoard profile!",
          profileImageUrl: user.profileImageUrl || undefined,
        });
        console.log("Profile created successfully:", profile.id);

        // Send welcome email
        await sendWelcomeEmail(user.email, profile.pageName);
      } catch (error) {
        console.error("Error creating profile:", error);
        throw error;
      }
    }

    // Update user as verified AFTER profile creation
    await storage.updateUser(user.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    res.json({
      message: "Email verified successfully!",
      redirectTo: "/dashboard",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// Request password reset
router.post("/forgot-password", emailLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal whether user exists or not
      return res.json({ 
        message: "If an account with that email exists, we've sent a password reset link." 
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await storage.updateUserPasswordResetToken(user.id, resetToken, resetExpires);

    // Send password reset email
    await sendPasswordResetEmail(email, resetToken);

    res.json({ 
      message: "If an account with that email exists, we've sent a password reset link." 
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});

// Reset password with token
router.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    // Find user by reset token
    const user = await storage.getUserByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Check if token is expired
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password and clear reset token
    await storage.updateUser(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    res.json({ message: "Password reset successful! You can now log in with your new password." });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Resend verification email
router.post("/resend-verification", emailLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal whether user exists or not
      return res.json({ message: "If an account with that email exists, we've sent a verification email." });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await storage.updateUserVerificationToken(user.id, verificationToken, verificationExpires);

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.json({ message: "If an account with that email exists, we've sent a verification email." });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  req.session?.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ message: "Logout successful" });
  });
});

// Get current user
router.get("/user", async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = await storage.getProfileByUserId(user.id);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isEmailVerified: user.isEmailVerified,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;