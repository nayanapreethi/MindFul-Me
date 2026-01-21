/**
 * Voice Analysis Routes
 * Voice biometrics upload and analysis
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';
import { 
  getUserById, 
  insertVoiceBiometrics,
  supabase,
  TABLES
} from '../lib/supabase';
import { verifyToken, extractToken } from './auth';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: WAV, MP3, WebM, OGG'));
    }
  },
});

// Environment variables
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Upload and analyze voice recording
router.post('/analyze', upload.single('audio'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create form data for ML service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: `voice-${uuidv4()}.wav`,
      contentType: req.file.mimetype,
    });

    // Send to ML service for analysis
    const response = await axios.post(`${ML_SERVICE_URL}/analyze/voice`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 60 seconds timeout
    });

    const analysisResult = response.data;

    // Save to database
    const biometrics = await insertVoiceBiometrics({
      id: uuidv4(),
      user_id: decoded.userId,
      pitch_features: analysisResult.pitchFeatures,
      jitter_features: analysisResult.jitterFeatures,
      shimmer_features: analysisResult.shimmerFeatures,
      cadence_features: analysisResult.cadenceFeatures,
      intensity_features: analysisResult.intensityFeatures,
      flat_affect_score: analysisResult.flatAffectScore,
      agitated_speech_score: analysisResult.agitatedSpeechScore,
      overall_vocal_health_score: analysisResult.vocalHealthScore,
      detected_anomalies: analysisResult.anomalies,
      requires_clinical_review: analysisResult.flatAffectScore > 0.7 || analysisResult.agitatedSpeechScore > 0.7,
      recording_duration_seconds: analysisResult.durationSeconds,
    });

    if (!biometrics) {
      return res.status(500).json({ error: 'Failed to save voice biometrics' });
    }

    res.status(201).json({
      message: 'Voice analysis completed',
      analysis: {
        id: biometrics.id,
        flatAffectScore: analysisResult.flatAffectScore,
        agitatedSpeechScore: analysisResult.agitatedSpeechScore,
        vocalHealthScore: analysisResult.vocalHealthScore,
        duration: analysisResult.durationSeconds,
        insights: analysisResult.insights,
        anomalies: analysisResult.anomalies,
        requiresClinicalReview: biometrics.requires_clinical_review,
      },
      mentalHealthIndicators: {
        flatAffect: {
          score: analysisResult.flatAffectScore,
          interpretation: interpretFlatAffect(analysisResult.flatAffectScore),
          recommendation: getFlatAffectRecommendation(analysisResult.flatAffectScore),
        },
        agitatedSpeech: {
          score: analysisResult.agitatedSpeechScore,
          interpretation: interpretAgitation(analysisResult.agitatedSpeechScore),
          recommendation: getAgitationRecommendation(analysisResult.agitatedSpeechScore),
        },
      },
    });
  } catch (error: any) {
    if (error.message === 'Invalid file type') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Get voice analysis history
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const limit = parseInt(req.query.limit as string) || 30;

    const { data, error } = await supabase
      .from(TABLES.VOICE_BIOMETRICS)
      .select('*')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch voice analysis history' });
    }

    // Calculate trends
    const flatAffectScores = data.map(d => d.flat_affect_score);
    const agitationScores = data.map(d => d.agitated_speech_score);
    const vocalHealthScores = data.map(d => d.overall_vocal_health_score);

    const avgFlatAffect = flatAffectScores.length > 0 
      ? flatAffectScores.reduce((a, b) => a + b, 0) / flatAffectScores.length 
      : 0;

    const avgAgitation = agitationScores.length > 0 
      ? agitationScores.reduce((a, b) => a + b, 0) / agitationScores.length 
      : 0;

    const avgVocalHealth = vocalHealthScores.length > 0 
      ? vocalHealthScores.reduce((a, b) => a + b, 0) / vocalHealthScores.length 
      : 0;

    res.json({
      analyses: data.map(d => ({
        id: d.id,
        flatAffectScore: d.flat_affect_score,
        agitatedSpeechScore: d.agitated_speech_score,
        vocalHealthScore: d.overall_vocal_health_score,
        duration: d.recording_duration_seconds,
        anomalies: d.detected_anomalies,
        requiresClinicalReview: d.requires_clinical_review,
        createdAt: d.created_at,
      })),
      summary: {
        totalAnalyses: data.length,
        averageFlatAffect: avgFlatAffect,
        averageAgitation: avgAgitation,
        averageVocalHealth: avgVocalHealth,
        trend: calculateVoiceTrend(data),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single voice analysis
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
      .from(TABLES.VOICE_BIOMETRICS)
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({
      analysis: {
        id: data.id,
        pitchFeatures: data.pitch_features,
        jitterFeatures: data.jitter_features,
        shimmerFeatures: data.shimmer_features,
        cadenceFeatures: data.cadence_features,
        intensityFeatures: data.intensity_features,
        flatAffectScore: data.flat_affect_score,
        agitatedSpeechScore: data.agitated_speech_score,
        vocalHealthScore: data.overall_vocal_health_score,
        anomalies: data.detected_anomalies,
        requiresClinicalReview: data.requires_clinical_review,
        duration: data.recording_duration_seconds,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete voice analysis
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
      .from(TABLES.VOICE_BIOMETRICS)
      .delete()
      .eq('id', id)
      .eq('user_id', decoded.userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete analysis' });
    }

    res.json({
      message: 'Voice analysis deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function interpretFlatAffect(score: number): string {
  if (score < 0.3) return 'Normal emotional expression';
  if (score < 0.5) return 'Slightly reduced expressiveness';
  if (score < 0.7) return 'Moderately flat affect';
  return 'Significantly flat affect';
}

function interpretAgitation(score: number): string {
  if (score < 0.3) return 'Speech appears calm and composed';
  if (score < 0.5) return 'Mild signs of tension in speech';
  if (score < 0.7) return 'Moderate agitation detected';
  return 'Significant agitation in speech patterns';
}

function getFlatAffectRecommendation(score: number): string {
  if (score < 0.3) return 'Your voice shows healthy emotional expression.';
  if (score < 0.5) return 'Try varying your tone when speaking to maintain expressiveness.';
  if (score < 0.7) return 'Consider activities that bring out positive emotions.';
  return 'Consider speaking with a mental health professional about emotional expression.';
}

function getAgitationRecommendation(score: number): string {
  if (score < 0.3) return 'Your speech patterns appear calm and steady.';
  if (score < 0.5) return 'Your speech shows minor tension. Deep breathing may help.';
  if (score < 0.7) return 'Practice mindful speaking and relaxation techniques.';
  return 'Consider calming exercises before important conversations.';
}

function calculateVoiceTrend(data: any[]): string {
  if (data.length < 3) return 'insufficient_data';

  const recent = data.slice(0, Math.min(5, data.length));
  const older = data.slice(Math.min(5, data.length));

  if (older.length === 0) return 'insufficient_data';

  const recentAvg = recent.reduce((a, b) => a + b.overall_vocal_health_score, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b.overall_vocal_health_score, 0) / older.length;

  if (recentAvg - olderAvg > 5) return 'improving';
  if (olderAvg - recentAvg > 5) return 'declining';
  return 'stable';
}

export default router;

