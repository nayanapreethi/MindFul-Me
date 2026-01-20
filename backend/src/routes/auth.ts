import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth';
import { asyncHandler, ValidationError, UnauthorizedError, AppError } from '../middleware/errorHandler';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed', 
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { email, password, firstName, lastName, dateOfBirth, phoneNumber } = validation.data;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, mental_health_index, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, dateOfBirth || null, phoneNumber || null]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)`,
      [user.id, refreshTokenHash, req.headers['user-agent'] || '', req.ip]
    );

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        mentalHealthIndex: user.mental_health_index,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    });
  })
);

/**
 * POST /api/auth/login
 * User login
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { email, password } = validation.data;

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, mental_health_index,
              failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account temporarily locked. Please try again later.', 423, 'ACCOUNT_LOCKED');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed login attempts
      await pool.query(
        `UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE WHEN failed_login_attempts + 1 >= 4 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
         WHERE id = $1`,
        [user.id]
      );
      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset failed login attempts and update last login
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)`,
      [user.id, refreshTokenHash, req.headers['user-agent'] || '', req.ip]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        mentalHealthIndex: user.mental_health_index,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = refreshSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { refreshToken } = validation.data;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Get user
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    res.json({
      accessToken,
      expiresIn: 900,
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user (revoke refresh token)
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Revoke all refresh tokens for user
    await pool.query(
      `UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`,
      [userId]
    );

    res.json({ message: 'Logged out successfully' });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, date_of_birth, phone_number,
              profile_picture_url, phq9_score, gad7_score, mental_health_index,
              notification_preferences, accessibility_settings, theme_preferences,
              biometric_enabled, two_factor_enabled, consent_given, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      dateOfBirth: user.date_of_birth,
      phoneNumber: user.phone_number,
      profilePictureUrl: user.profile_picture_url,
      phq9Score: user.phq9_score,
      gad7Score: user.gad7_score,
      mentalHealthIndex: user.mental_health_index,
      notificationPreferences: user.notification_preferences,
      accessibilitySettings: user.accessibility_settings,
      themePreferences: user.theme_preferences,
      biometricEnabled: user.biometric_enabled,
      twoFactorEnabled: user.two_factor_enabled,
      consentGiven: user.consent_given,
      createdAt: user.created_at,
    });
  })
);

export default router;
