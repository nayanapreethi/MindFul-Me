/**
 * Journal Routes
 * Encrypted journal entries with sentiment analysis
 */

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import CryptoJS from 'crypto-js';
import { 
  getUserById, 
  insertJournalEntry, 
  getJournalEntriesByUser, 
  updateUser,
  TABLES,
  supabase,
  JournalEntry
} from '../lib/supabase';
import { verifyToken, extractToken } from './auth';

const router = Router();

// Environment variables
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ENCRYPTION_KEY = process.env.JOURNAL_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

// Validation schemas
const createJournalEntrySchema = z.object({
  content: z.string().min(1, 'Journal content is required').max(10000),
  title: z.string().max(255).optional(),
  entryType: z.enum(['general', 'gratitude', 'reflection', 'free_write']).default('general'),
});

const updateJournalEntrySchema = z.object({
  title: z.string().max(255).optional(),
  entryType: z.enum(['general', 'gratitude', 'reflection', 'free_write']).optional(),
  isSharedWithDoctor: z.boolean().optional(),
});

// Encryption utilities
function encryptContent(content: string): { encrypted: string; iv: string } {
  const iv = CryptoJS.lib.WordArray.random(16).toString();
  const encrypted = CryptoJS.AES.encrypt(content, ENCRYPTION_KEY, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
  
  return { encrypted, iv };
}

function decryptContent(encrypted: string, iv: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}

// Analyze text with ML service
async function analyzeText(text: string): Promise<any> {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/analyze/text`, { text });
    return response.data;
  } catch (error) {
    console.error('ML service analysis failed:', error);
    return {
      sentimentScore: 0.5,
      sentiment: 'neutral',
      emotions: { neutral: 1.0 },
      keyPhrases: [],
      insights: ['Analysis unavailable'],
    };
  }
}

// Create journal entry
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate request
    const validationResult = createJournalEntrySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { content, title, entryType } = validationResult.data;
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Encrypt content
    const { encrypted, iv } = encryptContent(content);

    // Analyze sentiment
    const analysis = await analyzeText(content);

    // Check for crisis in content
    const crisisKeywords = ['suicide', 'suicidal', 'kill myself', 'end my life', 'self-harm'];
    const isCrisis = crisisKeywords.some(keyword => content.toLowerCase().includes(keyword));

    // Create journal entry
    const entry = await insertJournalEntry({
      id: uuidv4(),
      user_id: decoded.userId,
      encrypted_content: encrypted,
      encryption_iv: iv,
      title: title || `Journal - ${new Date().toLocaleDateString()}`,
      entry_type: entryType,
      is_shared_with_doctor: false,
      sentiment_analysis: {
        sentimentScore: analysis.sentimentScore,
        sentiment: analysis.sentiment,
      },
      emotion_tags: analysis.emotions,
      key_phrases: analysis.keyPhrases,
      ai_recommendations: analysis.insights,
      current_sentiment_score: analysis.sentimentScore,
      emotional_insights: analysis.insights,
    });

    if (!entry) {
      return res.status(500).json({ error: 'Failed to save journal entry' });
    }

    res.status(201).json({
      message: 'Journal entry saved successfully',
      entry: {
        id: entry.id,
        title: entry.title,
        entryType: entry.entry_type,
        sentimentScore: analysis.sentimentScore,
        sentiment: analysis.sentiment,
        emotions: analysis.emotions,
        createdAt: entry.created_at,
        crisisAlert: isCrisis ? {
          type: 'CRISIS_CONTENT_DETECTED',
          message: 'Your entry contains concerning language. Please reach out for support.',
          resources: [
            { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
            { name: 'National Suicide Prevention Lifeline', contact: '988' },
          ],
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all journal entries
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const entries = await getJournalEntriesByUser(decoded.userId, limit);

    // Decrypt content for response
    const decryptedEntries = entries.map(entry => ({
      id: entry.id,
      title: entry.title,
      entryType: entry.entry_type,
      content: decryptContent(entry.encrypted_content, entry.encryption_iv),
      sentimentScore: entry.current_sentiment_score,
      emotions: entry.emotion_tags,
      keyPhrases: entry.key_phrases,
      isSharedWithDoctor: entry.is_shared_with_doctor,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));

    // Calculate summary
    const sentiments = entries
      .filter(e => e.current_sentiment_score !== null)
      .map(e => e.current_sentiment_score!);
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
      : 0.5;

    res.json({
      entries: decryptedEntries,
      summary: {
        totalEntries: entries.length,
        averageSentiment: avgSentiment,
        byType: entries.reduce((acc: { [key: string]: number }, entry) => {
          acc[entry.entry_type] = (acc[entry.entry_type] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single journal entry
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = data as JournalEntry;

    res.json({
      entry: {
        id: entry.id,
        title: entry.title,
        entryType: entry.entry_type,
        content: decryptContent(entry.encrypted_content, entry.encryption_iv),
        sentimentScore: entry.current_sentiment_score,
        emotions: entry.emotion_tags,
        keyPhrases: entry.key_phrases,
        aiRecommendations: entry.ai_recommendations,
        isSharedWithDoctor: entry.is_shared_with_doctor,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update journal entry
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const validationResult = updateJournalEntrySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    // Check if entry exists and belongs to user
    const { data: existingEntry, error: fetchError } = await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.userId)
      .single();

    if (fetchError || !existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const updates: Partial<JournalEntry> = {};
    const { title, entryType, isSharedWithDoctor } = validationResult.data;

    if (title) updates.title = title;
    if (entryType) updates.entry_type = entryType;
    if (isSharedWithDoctor !== undefined) updates.is_shared_with_doctor = isSharedWithDoctor;

    const { error: updateError } = await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .update(updates)
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update entry' });
    }

    res.json({
      message: 'Journal entry updated successfully',
      entryId: id,
    });
  } catch (error) {
    next(error);
  }
});

// Delete journal entry
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .delete()
      .eq('id', id)
      .eq('user_id', decoded.userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete entry' });
    }

    res.json({
      message: 'Journal entry deleted successfully',
      entryId: id,
    });
  } catch (error) {
    next(error);
  }
});

// Real-time sentiment analysis
router.post('/analyze/realtime', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 3) {
      return res.json({
        sentimentScore: 0.5,
        sentiment: 'neutral',
        isCrisis: false,
      });
    }

    // Quick crisis check
    const crisisKeywords = ['suicide', 'suicidal', 'kill myself', 'end my life', 'self-harm'];
    const isCrisis = crisisKeywords.some(keyword => text.toLowerCase().includes(keyword));

    // Get quick sentiment from ML service
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/analyze/realtime`, { text });
      res.json({
        ...response.data,
        isCrisis,
        crisisAlert: isCrisis ? {
          type: 'CRISIS_CONTENT_DETECTED',
          message: 'Your writing contains concerning language. Please consider reaching out for support.',
        } : null,
      });
    } catch {
      res.json({
        sentimentScore: 0.5,
        sentiment: 'neutral',
        isCrisis,
        crisisAlert: isCrisis ? {
          type: 'CRISIS_CONTENT_DETECTED',
          message: 'Your writing contains concerning language. Please consider reaching out for support.',
        } : null,
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get journal statistics
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get all entries
    const entries = await getJournalEntriesByUser(decoded.userId, 365);

    // Calculate statistics
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEntries = entries.filter(e => new Date(e.created_at) > weekAgo);
    const monthlyEntries = entries.filter(e => new Date(e.created_at) > monthAgo);

    const sentiments = entries
      .filter(e => e.current_sentiment_score !== null)
      .map(e => e.current_sentiment_score!);

    // Dominant emotions
    const allEmotions: { [key: string]: number } = {};
    entries.forEach(e => {
      if (e.emotion_tags) {
        Object.entries(e.emotion_tags).forEach(([emotion, score]) => {
          allEmotions[emotion] = (allEmotions[emotion] || 0) + score;
        });
      }
    });

    const dominantEmotion = Object.entries(allEmotions)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    res.json({
      statistics: {
        totalEntries: entries.length,
        entriesThisWeek: recentEntries.length,
        entriesThisMonth: monthlyEntries.length,
        averageSentiment: sentiments.length > 0 
          ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
          : 0.5,
        dominantEmotion,
        writingStreak: calculateWritingStreak(entries),
        byType: entries.reduce((acc: { [key: string]: number }, entry) => {
          acc[entry.entry_type] = (acc[entry.entry_type] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

function calculateWritingStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  const sortedDates = [...new Set(entries.map(e => 
    new Date(e.created_at).toISOString().split('T')[0]
  ))].sort().reverse();

  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasEntry = sortedDates.includes(dateStr);
    
    if (hasEntry) {
      streak++;
    } else if (dateStr !== today) {
      break;
    }
    
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export default router;

