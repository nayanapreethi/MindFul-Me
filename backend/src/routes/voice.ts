import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ValidationError, NotFoundError, AppError } from '../middleware/errorHandler';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ML Service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/voice');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported formats: WAV, MP3, WebM, OGG'));
    }
  },
});

/**
 * Analyze voice using ML service
 */
async function analyzeVoice(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const boundary = `----FormBoundary${Date.now()}`;
      const fileName = path.basename(filePath);
      
      // Build multipart form data manually
      const header = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([header, fileBuffer, footer]);

      const url = new URL(`${ML_SERVICE_URL}/analyze/voice`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Voice analysis error:', error);
        resolve(null);
      });

      req.write(body);
      req.end();
    } catch (error) {
      console.error('Voice analysis error:', error);
      resolve(null);
    }
  });
}

/**
 * GET /api/voice
 * Get all voice biometrics for the user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, overall_vocal_health_score, flat_affect_score, agitated_speech_score,
              recording_duration_seconds, requires_clinical_review, created_at
       FROM voice_biometrics
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM voice_biometrics WHERE user_id = $1`,
      [userId]
    );

    res.json({
      recordings: result.rows.map(record => ({
        id: record.id,
        vocalHealthScore: record.overall_vocal_health_score,
        flatAffectScore: record.flat_affect_score,
        agitatedSpeechScore: record.agitated_speech_score,
        durationSeconds: record.recording_duration_seconds,
        requiresClinicalReview: record.requires_clinical_review,
        createdAt: record.created_at,
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
 * GET /api/voice/:id
 * Get a specific voice biometric record
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const recordId = req.params.id;

    const result = await pool.query(
      `SELECT id, pitch_features, jitter_features, shimmer_features, cadence_features,
              intensity_features, flat_affect_score, agitated_speech_score,
              overall_vocal_health_score, detected_anomalies, requires_clinical_review,
              recording_duration_seconds, created_at
       FROM voice_biometrics
       WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Voice biometric record');
    }

    const record = result.rows[0];

    res.json({
      id: record.id,
      pitchFeatures: record.pitch_features,
      jitterFeatures: record.jitter_features,
      shimmerFeatures: record.shimmer_features,
      cadenceFeatures: record.cadence_features,
      intensityFeatures: record.intensity_features,
      flatAffectScore: record.flat_affect_score,
      agitatedSpeechScore: record.agitated_speech_score,
      vocalHealthScore: record.overall_vocal_health_score,
      detectedAnomalies: record.detected_anomalies,
      requiresClinicalReview: record.requires_clinical_review,
      durationSeconds: record.recording_duration_seconds,
      createdAt: record.created_at,
    });
  })
);

/**
 * POST /api/voice/upload
 * Upload and analyze a voice recording
 */
router.post(
  '/upload',
  authenticate,
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    if (!req.file) {
      throw new ValidationError('Audio file is required', { audio: 'No file uploaded' });
    }

    const filePath = req.file.path;

    // Analyze voice using ML service
    const analysis = await analyzeVoice(filePath);

    if (!analysis) {
      // Clean up file
      fs.unlinkSync(filePath);
      throw new AppError('Voice analysis failed. Please try again.', 503, 'ML_SERVICE_ERROR');
    }

    // Determine if clinical review is needed
    const requiresClinicalReview = 
      (analysis.flatAffectScore && analysis.flatAffectScore > 0.7) ||
      (analysis.agitatedSpeechScore && analysis.agitatedSpeechScore > 0.7);

    // Store voice biometrics
    const result = await pool.query(
      `INSERT INTO voice_biometrics (
         user_id, encrypted_audio_path, pitch_features, jitter_features,
         shimmer_features, cadence_features, intensity_features,
         flat_affect_score, agitated_speech_score, overall_vocal_health_score,
         detected_anomalies, requires_clinical_review, recording_duration_seconds
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, overall_vocal_health_score, requires_clinical_review, created_at`,
      [
        userId,
        filePath,
        JSON.stringify(analysis.pitchFeatures || {}),
        JSON.stringify(analysis.jitterFeatures || {}),
        JSON.stringify(analysis.shimmerFeatures || {}),
        JSON.stringify(analysis.cadenceFeatures || {}),
        JSON.stringify(analysis.intensityFeatures || {}),
        analysis.flatAffectScore || null,
        analysis.agitatedSpeechScore || null,
        analysis.vocalHealthScore || null,
        analysis.anomalies ? JSON.stringify(analysis.anomalies) : null,
        requiresClinicalReview,
        analysis.durationSeconds || null,
      ]
    );

    res.status(201).json({
      message: 'Voice recording analyzed successfully',
      record: {
        id: result.rows[0].id,
        vocalHealthScore: result.rows[0].overall_vocal_health_score,
        requiresClinicalReview: result.rows[0].requires_clinical_review,
        createdAt: result.rows[0].created_at,
      },
      analysis: {
        pitchFeatures: analysis.pitchFeatures,
        cadenceFeatures: analysis.cadenceFeatures,
        flatAffectScore: analysis.flatAffectScore,
        agitatedSpeechScore: analysis.agitatedSpeechScore,
        vocalHealthScore: analysis.vocalHealthScore,
        insights: analysis.insights,
      },
    });
  })
);

/**
 * DELETE /api/voice/:id
 * Delete a voice biometric record
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const recordId = req.params.id;

    // Get file path before deletion
    const fileResult = await pool.query(
      `SELECT encrypted_audio_path FROM voice_biometrics WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    );

    if (fileResult.rows.length === 0) {
      throw new NotFoundError('Voice biometric record');
    }

    // Delete from database
    await pool.query(
      `DELETE FROM voice_biometrics WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    );

    // Delete file if exists
    const filePath = fileResult.rows[0].encrypted_audio_path;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Voice recording deleted successfully' });
  })
);

/**
 * GET /api/voice/trends
 * Get voice analysis trends over time
 */
router.get(
  '/trends',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const result = await pool.query(
      `SELECT DATE(created_at) as date,
              AVG(overall_vocal_health_score) as avg_vocal_health,
              AVG(flat_affect_score) as avg_flat_affect,
              AVG(agitated_speech_score) as avg_agitated_speech,
              COUNT(*) as recording_count
       FROM voice_biometrics
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL $2 days
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, days]
    );

    res.json({
      trends: result.rows.map(row => ({
        date: row.date,
        avgVocalHealth: parseFloat(row.avg_vocal_health) || 0,
        avgFlatAffect: parseFloat(row.avg_flat_affect) || 0,
        avgAgitatedSpeech: parseFloat(row.avg_agitated_speech) || 0,
        recordingCount: parseInt(row.recording_count),
      })),
    });
  })
);

export default router;
