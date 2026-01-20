import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ML Service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Validation schemas
const journalEntrySchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().min(1, 'Content is required'),
  entryType: z.enum(['general', 'gratitude', 'reflection', 'free_write']).default('general'),
  isSharedWithDoctor: z.boolean().default(false),
});

const updateJournalSchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().min(1).optional(),
  entryType: z.enum(['general', 'gratitude', 'reflection', 'free_write']).optional(),
  isSharedWithDoctor: z.boolean().optional(),
});

/**
 * Get encryption key from environment - throws error if not configured
 */
function getEncryptionKey(): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey === 'default-key-change-in-production') {
    throw new Error('ENCRYPTION_KEY environment variable must be configured for production use');
  }
  return encryptionKey;
}

/**
 * Encrypt content using AES-256
 */
function encryptContent(content: string, userId: string): { encrypted: string; iv: string } {
  const encryptionKey = getEncryptionKey();
  const iv = CryptoJS.lib.WordArray.random(16).toString();
  const key = CryptoJS.SHA256(encryptionKey + userId).toString();

  const encrypted = CryptoJS.AES.encrypt(content, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();

  return { encrypted, iv };
}

/**
 * Decrypt content using AES-256
 */
function decryptContent(encrypted: string, iv: string, userId: string): string {
  const encryptionKey = getEncryptionKey();
  const key = CryptoJS.SHA256(encryptionKey + userId).toString();

  const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Analyze text sentiment using ML service
 */
async function analyzeTextSentiment(text: string): Promise<any> {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/analyze/text`, { text });
    return response.data;
  } catch (error) {
    console.error('ML Service error:', error);
    return null;
  }
}

/**
 * GET /api/journal
 * Get all journal entries for the user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const entryType = req.query.type as string;

    let query = `
      SELECT id, title, entry_type, is_shared_with_doctor, 
             current_sentiment_score, emotion_tags, created_at, updated_at
      FROM journal_entries
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (entryType) {
      query += ` AND entry_type = $2`;
      params.push(entryType);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM journal_entries WHERE user_id = $1`,
      [userId]
    );

    res.json({
      entries: result.rows.map(entry => ({
        id: entry.id,
        title: entry.title,
        entryType: entry.entry_type,
        isSharedWithDoctor: entry.is_shared_with_doctor,
        sentimentScore: entry.current_sentiment_score,
        emotionTags: entry.emotion_tags,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  })
);

/**
 * GET /api/journal/:id
 * Get a specific journal entry
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const entryId = req.params.id;

    const result = await pool.query(
      `SELECT id, title, encrypted_content, encryption_iv, entry_type, 
              is_shared_with_doctor, sentiment_analysis, emotion_tags, 
              key_phrases, ai_recommendations, current_sentiment_score,
              emotional_insights, created_at, updated_at
       FROM journal_entries
       WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Journal entry');
    }

    const entry = result.rows[0];

    // Decrypt content
    const content = decryptContent(entry.encrypted_content, entry.encryption_iv, userId);

    res.json({
      id: entry.id,
      title: entry.title,
      content,
      entryType: entry.entry_type,
      isSharedWithDoctor: entry.is_shared_with_doctor,
      sentimentAnalysis: entry.sentiment_analysis,
      emotionTags: entry.emotion_tags,
      keyPhrases: entry.key_phrases,
      aiRecommendations: entry.ai_recommendations,
      sentimentScore: entry.current_sentiment_score,
      emotionalInsights: entry.emotional_insights,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    });
  })
);

/**
 * POST /api/journal
 * Create a new journal entry
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = journalEntrySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { title, content, entryType, isSharedWithDoctor } = validation.data;

    // Encrypt content
    const { encrypted, iv } = encryptContent(content, userId);

    // Analyze sentiment (async, don't block response)
    const sentimentAnalysis = await analyzeTextSentiment(content);

    // Insert journal entry
    const result = await pool.query(
      `INSERT INTO journal_entries (
         user_id, title, encrypted_content, encryption_iv, entry_type,
         is_shared_with_doctor, sentiment_analysis, emotion_tags,
         key_phrases, current_sentiment_score, emotional_insights
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, entry_type, is_shared_with_doctor, 
                 current_sentiment_score, created_at`,
      [
        userId,
        title || null,
        encrypted,
        iv,
        entryType,
        isSharedWithDoctor,
        sentimentAnalysis ? JSON.stringify(sentimentAnalysis) : null,
        sentimentAnalysis?.emotions ? JSON.stringify(sentimentAnalysis.emotions) : null,
        sentimentAnalysis?.keyPhrases ? JSON.stringify(sentimentAnalysis.keyPhrases) : null,
        sentimentAnalysis?.sentimentScore || null,
        sentimentAnalysis?.insights ? JSON.stringify(sentimentAnalysis.insights) : null,
      ]
    );

    res.status(201).json({
      message: 'Journal entry created successfully',
      entry: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        entryType: result.rows[0].entry_type,
        isSharedWithDoctor: result.rows[0].is_shared_with_doctor,
        sentimentScore: result.rows[0].current_sentiment_score,
        createdAt: result.rows[0].created_at,
      },
      analysis: sentimentAnalysis,
    });
  })
);

/**
 * PUT /api/journal/:id
 * Update a journal entry
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const entryId = req.params.id;

    const validation = updateJournalSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    // Check if entry exists and belongs to user
    const existingEntry = await pool.query(
      `SELECT id FROM journal_entries WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    if (existingEntry.rows.length === 0) {
      throw new NotFoundError('Journal entry');
    }

    const { title, content, entryType, isSharedWithDoctor } = validation.data;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }

    if (content !== undefined) {
      const { encrypted, iv } = encryptContent(content, userId);
      updates.push(`encrypted_content = $${paramIndex++}`);
      values.push(encrypted);
      updates.push(`encryption_iv = $${paramIndex++}`);
      values.push(iv);

      // Re-analyze sentiment
      const sentimentAnalysis = await analyzeTextSentiment(content);
      if (sentimentAnalysis) {
        updates.push(`sentiment_analysis = $${paramIndex++}`);
        values.push(JSON.stringify(sentimentAnalysis));
        updates.push(`current_sentiment_score = $${paramIndex++}`);
        values.push(sentimentAnalysis.sentimentScore);
      }
    }

    if (entryType !== undefined) {
      updates.push(`entry_type = $${paramIndex++}`);
      values.push(entryType);
    }

    if (isSharedWithDoctor !== undefined) {
      updates.push(`is_shared_with_doctor = $${paramIndex++}`);
      values.push(isSharedWithDoctor);
    }

    if (updates.length === 0) {
      res.json({ message: 'No changes made' });
      return;
    }

    values.push(entryId, userId);

    const result = await pool.query(
      `UPDATE journal_entries SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, title, entry_type, is_shared_with_doctor, updated_at`,
      values
    );

    res.json({
      message: 'Journal entry updated successfully',
      entry: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        entryType: result.rows[0].entry_type,
        isSharedWithDoctor: result.rows[0].is_shared_with_doctor,
        updatedAt: result.rows[0].updated_at,
      },
    });
  })
);

/**
 * DELETE /api/journal/:id
 * Delete a journal entry
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const entryId = req.params.id;

    const result = await pool.query(
      `DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Journal entry');
    }

    res.json({ message: 'Journal entry deleted successfully' });
  })
);

/**
 * POST /api/journal/:id/analyze
 * Re-analyze a journal entry
 */
router.post(
  '/:id/analyze',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const entryId = req.params.id;

    // Get entry
    const result = await pool.query(
      `SELECT encrypted_content, encryption_iv FROM journal_entries
       WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Journal entry');
    }

    // Decrypt content
    const content = decryptContent(
      result.rows[0].encrypted_content,
      result.rows[0].encryption_iv,
      userId
    );

    // Analyze sentiment
    const sentimentAnalysis = await analyzeTextSentiment(content);

    if (!sentimentAnalysis) {
      res.status(503).json({ error: 'ML service unavailable' });
      return;
    }

    // Update entry with new analysis
    await pool.query(
      `UPDATE journal_entries SET 
         sentiment_analysis = $1,
         emotion_tags = $2,
         key_phrases = $3,
         current_sentiment_score = $4,
         emotional_insights = $5,
         updated_at = NOW()
       WHERE id = $6`,
      [
        JSON.stringify(sentimentAnalysis),
        sentimentAnalysis.emotions ? JSON.stringify(sentimentAnalysis.emotions) : null,
        sentimentAnalysis.keyPhrases ? JSON.stringify(sentimentAnalysis.keyPhrases) : null,
        sentimentAnalysis.sentimentScore,
        sentimentAnalysis.insights ? JSON.stringify(sentimentAnalysis.insights) : null,
        entryId,
      ]
    );

    res.json({
      message: 'Analysis complete',
      analysis: sentimentAnalysis,
    });
  })
);

export default router;
