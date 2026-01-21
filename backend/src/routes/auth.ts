/**
 * Authentication Routes
 * Login, Signup, JWT Token Management, Biometrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { supabase, TABLES, createUser, getUserByEmail, updateUser, insertAuditLog, User } from '../lib/supabase';

const router = Router();

// Environment variables
const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  consentGiven: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  enableBiometrics: z.boolean().optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Generate JWT token
function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Generate refresh token
function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  }
)

// Verify JWT token
export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch {
    return null;
  }
}

// Extract token from header
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Register new user
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { email, password, firstName, lastName, phoneNumber, consentGiven } = validationResult.data;

    // Check if consent was given (HIPAA compliance)
    if (!consentGiven) {
      return res.status(400).json({
        error: 'Consent required',
        message: 'You must agree to the privacy policy and data processing terms',
      });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await createUser({
      id: uuidv4(),
      email,
      passwordHash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      biometric_enabled: false,
      two_factor_enabled: false,
      consent_given: true,
      consent_timestamp: new Date().toISOString(),
      mental_health_index: 50.0, // Default MHI
      phq9_score: 0,
      gad7_score: 0,
      notification_preferences: { email: true, push: true, sms: false },
      accessibility_settings: { highContrast: false, screenReader: false, fontSize: 'medium' },
      theme_preferences: { mode: 'light', glassmorphism: true },
    });

    if (!user) {
      return res.status(500).json({
        error: 'Registration failed',
        message: 'Could not create user account',
      });
    }

    // Generate tokens
    const token = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Log audit entry
    await insertAuditLog({
      user_id: user.id,
      action_type: 'USER_REGISTERED',
      resource_type: 'users',
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        mentalHealthIndex: user.mental_health_index,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// User login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { email, password, enableBiometrics } = validationResult.data;

    // Find user
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again later.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Increment failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const lockTime = failedAttempts >= 5 
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString() // Lock for 15 minutes
        : null;

      await updateUser(user.id, {
        failed_login_attempts: failedAttempts,
        locked_until: lockTime,
      });

      await insertAuditLog({
        user_id: user.id,
        action_type: 'LOGIN_FAILED',
        resource_type: 'users',
        resource_id: user.id,
        new_values: { failedAttempts },
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
      });

      return res.status(401).json({
        error: 'Authentication failed',
        message: failedAttempts >= 5 
          ? 'Account locked due to too many failed attempts'
          : 'Invalid email or password',
      });
    }

    // Check if biometrics should be enabled
    if (enableBiometrics) {
      await updateUser(user.id, { biometric_enabled: true });
    }

    // Generate tokens
    const token = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Reset failed login attempts and update last login
    await updateUser(user.id, {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
    });

    // Log audit entry
    await insertAuditLog({
      user_id: user.id,
      action_type: 'USER_LOGIN',
      resource_type: 'users',
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        biometricEnabled: user.biometric_enabled,
        mentalHealthIndex: user.mental_health_index,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh access token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = refreshTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { refreshToken } = validationResult.data;

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Please login again',
      });
    }

    // Get user
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Please login again',
      });
    }

    // Generate new access token
    const newToken = generateToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      message: 'Token refreshed',
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is expired or invalid',
      });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found',
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        profilePictureUrl: user.profile_picture_url,
        phq9Score: user.phq9_score,
        gad7Score: user.gad7_score,
        mentalHealthIndex: user.mental_health_index,
        biometricEnabled: user.biometric_enabled,
        twoFactorEnabled: user.two_factor_enabled,
        consentGiven: user.consent_given,
        preferences: {
          notifications: user.notification_preferences,
          accessibility: user.accessibility_settings,
          theme: user.theme_preferences,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is expired or invalid',
      });
    }

    const { firstName, lastName, phoneNumber, preferences } = req.body;

    const updates: Partial<User> = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (phoneNumber) updates.phone_number = phoneNumber;
    if (preferences) {
      if (preferences.notifications) updates.notification_preferences = preferences.notifications;
      if (preferences.accessibility) updates.accessibility_settings = preferences.accessibility;
      if (preferences.theme) updates.theme_preferences = preferences.theme;
    }

    const user = await updateUser(decoded.userId, updates);
    if (!user) {
      return res.status(500).json({
        error: 'Update failed',
        message: 'Could not update user profile',
      });
    }

    await insertAuditLog({
      user_id: decoded.userId,
      action_type: 'PROFILE_UPDATED',
      resource_type: 'users',
      resource_id: decoded.userId,
      new_values: updates,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        preferences: {
          notifications: user.notification_preferences,
          accessibility: user.accessibility_settings,
          theme: user.theme_preferences,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is expired or invalid',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'New password must be at least 8 characters',
      });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found',
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await updateUser(user.id, { password_hash: newPasswordHash });

    await insertAuditLog({
      user_id: user.id,
      action_type: 'PASSWORD_CHANGED',
      resource_type: 'users',
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Enable/disable biometrics
router.post('/biometrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is expired or invalid',
      });
    }

    const { enable } = req.body;

    await updateUser(decoded.userId, { biometric_enabled: Boolean(enable) });

    await insertAuditLog({
      user_id: decoded.userId,
      action_type: 'BIOMETRICS_UPDATED',
      resource_type: 'users',
      resource_id: decoded.userId,
      new_values: { biometric_enabled: enable },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      message: `Biometrics ${enable ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// Logout (invalidate token - client side)
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = verifyToken(token);
    if (decoded) {
      await insertAuditLog({
        user_id: decoded.userId,
        action_type: 'USER_LOGOUT',
        resource_type: 'users',
        resource_id: decoded.userId,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
      });
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

