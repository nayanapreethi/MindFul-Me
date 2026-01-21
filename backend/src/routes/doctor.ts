/**
 * Doctor Routes (Clinical Bridge)
 * Doctor registration, session codes, and patient data access
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import CryptoJS from 'crypto-js';
import {
  getUserById,
  insertDoctorConnection,
  getDoctorConnectionByToken,
  updateDoctorConnection,
  supabase,
  TABLES,
  User
} from '../lib/supabase';
import { verifyToken, extractToken } from './auth';

const router = Router();

// Environment variables
const SESSION_CODE_EXPIRY_HOURS = parseInt(process.env.SESSION_CODE_EXPIRY_HOURS || '24');
const ENCRYPTION_KEY = process.env.DOCTOR_BRIDGE_KEY || 'doctor-bridge-encryption-key';

// Validation schemas
const registerDoctorSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  specialization: z.string().optional(),
  licenseState: z.string().optional(),
  npiNumber: z.string().optional(),
});

const createSessionCodeSchema = z.object({
  permissions: z.object({
    viewMoodLogs: z.boolean().default(true),
    viewJournalEntries: z.boolean().default(true),
    viewVoiceAnalysis: z.boolean().default(true),
    viewMedicationLogs: z.boolean().default(true),
    viewBehavioralData: z.boolean().default(true),
    exportData: z.boolean().default(false),
  }).default({
    viewMoodLogs: true,
    viewJournalEntries: true,
    viewVoiceAnalysis: true,
    viewMedicationLogs: true,
    viewBehavioralData: true,
    exportData: false,
  }),
  expiresInHours: z.number().min(1).max(72).default(24),
});

// Generate 6-digit session code
function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Encrypt session code for storage
function encryptSessionCode(code: string): string {
  return CryptoJS.AES.encrypt(code, ENCRYPTION_KEY).toString();
}

// Decrypt session code
function decryptSessionCode(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Register doctor (simplified - in production, verification would be manual)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = registerDoctorSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Check if email already exists
    const { data: existingDoctor } = await supabase
      .from(TABLES.DOCTORS)
      .select('*')
      .eq('email', data.email)
      .single();

    if (existingDoctor) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'This email is already associated with a doctor account',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const { data: doctor, error } = await supabase
      .from(TABLES.DOCTORS)
      .insert({
        id: uuidv4(),
        email: data.email,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        license_number: data.licenseNumber,
        specialization: data.specialization,
        license_state: data.licenseState,
        npi_number: data.npiNumber,
        is_verified: true, // Auto-verify for demo; in production, this would be manual
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to register doctor' });
    }

    res.status(201).json({
      message: 'Doctor registration successful',
      doctor: {
        id: doctor.id,
        email: doctor.email,
        firstName: doctor.first_name,
        lastName: doctor.last_name,
        specialization: doctor.specialization,
        isVerified: doctor.is_verified,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Doctor login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: doctor, error } = await supabase
      .from(TABLES.DOCTORS)
      .select('*')
      .eq('email', email)
      .single();

    if (error || !doctor) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    if (!doctor.is_verified) {
      return res.status(403).json({
        error: 'Account not verified',
        message: 'Your account is pending verification',
      });
    }

    const isValidPassword = await bcrypt.compare(password, doctor.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Generate simple token (in production, use proper JWT)
    const token = CryptoJS.AES.encrypt(
      JSON.stringify({ doctorId: doctor.id, email: doctor.email }),
      ENCRYPTION_KEY
    ).toString();

    res.json({
      message: 'Login successful',
      doctor: {
        id: doctor.id,
        email: doctor.email,
        firstName: doctor.first_name,
        lastName: doctor.last_name,
        specialization: doctor.specialization,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Create session code for patient sharing
router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const validationResult = createSessionCodeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate session code
    const sessionCode = generateSessionCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    // Store connection
    const connection = await insertDoctorConnection({
      id: uuidv4(),
      patient_id: decoded.userId,
      doctor_id: '', // Will be set when doctor claims the code
      access_token: encryptSessionCode(sessionCode),
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      permissions: {
        view_mood_logs: data.permissions.viewMoodLogs,
        view_journal_entries: data.permissions.viewJournalEntries,
        view_voice_analysis: data.permissions.viewVoiceAnalysis,
        view_medication_logs: data.permissions.viewMedicationLogs,
        view_behavioral_data: data.permissions.viewBehavioralData,
        export_data: data.permissions.exportData,
      },
      access_count: 0,
    });

    if (!connection) {
      return res.status(500).json({ error: 'Failed to create session code' });
    }

    res.json({
      message: 'Session code created successfully',
      sessionCode,
      expiresAt: expiresAt.toISOString(),
      permissions: data.permissions,
      sharingInstructions: 'Share this 6-digit code with your healthcare provider. They can use it to access your MindfulMe data for the specified duration.',
    });
  } catch (error) {
    next(error);
  }
});

// Get active session codes
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: connections, error } = await supabase
      .from(TABLES.DOCTOR_CONNECTIONS)
      .select('*')
      .eq('patient_id', decoded.userId)
      .eq('is_active', true)
      .gt('token_expires_at', new Date().toISOString());

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }

    // Get doctor info for active connections
    const sessions = await Promise.all(connections.map(async (conn) => {
      let doctorInfo = null;
      if (conn.doctor_id) {
        const { data: doctor } = await supabase
          .from(TABLES.DOCTORS)
          .select('id, first_name, last_name, specialization')
          .eq('id', conn.doctor_id)
          .single();
        doctorInfo = doctor;
      }

      return {
        id: conn.id,
        doctorId: conn.doctor_id,
        doctorName: doctorInfo 
          ? `${doctorInfo.first_name} ${doctorInfo.last_name}`
          : 'Not claimed yet',
        specialization: doctorInfo?.specialization || null,
        isClaimed: !!conn.doctor_id,
        expiresAt: conn.token_expires_at,
        accessCount: conn.access_count,
        lastAccessedAt: conn.last_accessed_at,
        permissions: conn.permissions,
      };
    }));

    res.json({
      sessions,
      summary: {
        total: sessions.length,
        claimed: sessions.filter(s => s.isClaimed).length,
        pending: sessions.filter(s => !s.isClaimed).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Revoke session
router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
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
      .from(TABLES.DOCTOR_CONNECTIONS)
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: 'Revoked by patient',
      })
      .eq('id', id)
      .eq('patient_id', decoded.userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to revoke session' });
    }

    res.json({
      message: 'Session revoked successfully',
      sessionId: id,
    });
  } catch (error) {
    next(error);
  }
});

// Doctor: Access patient data with session code
router.post('/access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionCode, doctorId } = req.body;

    if (!sessionCode || !doctorId) {
      return res.status(400).json({ error: 'Session code and doctor ID are required' });
    }

    // Find and validate connection
    const { data: connections, error } = await supabase
      .from(TABLES.DOCTOR_CONNECTIONS)
      .select('*')
      .eq('is_active', true)
      .gt('token_expires_at', new Date().toISOString());

    if (error || !connections || connections.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired session code' });
    }

    // Find matching connection
    const connection = connections.find((conn: any) => {
      try {
        const decrypted = decryptSessionCode(conn.access_token);
        return decrypted === sessionCode;
      } catch {
        return false;
      }
    });

    if (!connection) {
      return res.status(401).json({ error: 'Invalid session code' });
    }

    // Verify doctor exists
    const { data: doctor, error: docError } = await supabase
      .from(TABLES.DOCTORS)
      .select('id, first_name, last_name, specialization')
      .eq('id', doctorId)
      .single();

    if (docError || !doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Update connection with doctor ID
    await supabase
      .from(TABLES.DOCTOR_CONNECTIONS)
      .update({ doctor_id: doctorId })
      .eq('id', connection.id);

    // Fetch patient data based on permissions
    const permissions = connection.permissions;
    const patientData: any = {};

    if (permissions.view_mood_logs) {
      const { data: moodLogs } = await supabase
        .from(TABLES.MOOD_LOGS)
        .select('*')
        .eq('user_id', connection.patient_id)
        .order('log_date', { ascending: false })
        .limit(30);
      patientData.moodLogs = moodLogs || [];
    }

    if (permissions.view_journal_entries) {
      const { data: journalEntries } = await supabase
        .from(TABLES.JOURNAL_ENTRIES)
        .select('id, title, entry_type, sentiment_analysis, emotion_tags, created_at')
        .eq('user_id', connection.patient_id)
        .order('created_at', { ascending: false })
        .limit(30);
      patientData.journalEntries = journalEntries || [];
    }

    if (permissions.view_voice_analysis) {
      const { data: voiceBiometrics } = await supabase
        .from(TABLES.VOICE_BIOMETRICS)
        .select('id, flat_affect_score, agitated_speech_score, overall_vocal_health_score, created_at')
        .eq('user_id', connection.patient_id)
        .order('created_at', { ascending: false })
        .limit(10);
      patientData.voiceAnalysis = voiceBiometrics || [];
    }

    if (permissions.view_medication_logs) {
      const { data: medicationLogs } = await supabase
        .from(TABLES.MEDICATION_LOGS)
        .select('*, medication:medication_id(medication_name, dosage)')
        .eq('medication:medication_id.user_id', connection.patient_id)
        .order('scheduled_time', { ascending: false })
        .limit(30);
      patientData.medicationLogs = medicationLogs || [];
    }

    // Update access count
    await supabase
      .from(TABLES.DOCTOR_CONNECTIONS)
      .update({
        access_count: connection.access_count + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    res.json({
      message: 'Patient data accessed successfully',
      accessToken: connection.access_token,
      expiresAt: connection.token_expires_at,
      permissions: connection.permissions,
      patientData: {
        moodTrends: calculateMoodTrends(patientData.moodLogs),
        mentalHealthIndex: await getLatestMHI(connection.patient_id),
        adherenceRate: calculateAdherenceRate(patientData.medicationLogs),
        voiceInsights: analyzeVoiceInsights(patientData.voiceAnalysis),
      },
      data: patientData,
    });
  } catch (error) {
    next(error);
  }
});

// Get patient summary (for claimed connections)
router.get('/patients/:patientId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.headers;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    const { patientId } = req.params;

    // Validate connection
    const connection = await getDoctorConnectionByToken(sessionToken as string);
    if (!connection) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (connection.patient_id !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch comprehensive patient summary
    const user = await getUserById(patientId);
    
    const { data: moodLogs } = await supabase
      .from(TABLES.MOOD_LOGS)
      .select('*')
      .eq('user_id', patientId)
      .order('log_date', { ascending: false })
      .limit(30);

    const { data: recentInsights } = await supabase
      .from(TABLES.PREDICTIVE_INSIGHTS)
      .select('*')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      patient: {
        id: user?.id,
        name: `${user?.first_name} ${user?.last_name}`,
        mentalHealthIndex: user?.mental_health_index,
        phq9Score: user?.phq9_score,
        gad7Score: user?.gad7_score,
      },
      summary: {
        moodTrends: calculateMoodTrends(moodLogs || []),
        recentInsights: recentInsights || [],
        alerts: recentInsights?.filter((i: any) => i.alert_triggered) || [],
      },
      permissions: connection.permissions,
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function calculateMoodTrends(logs: any[]): any {
  if (logs.length === 0) {
    return { trend: 'insufficient_data', averageMood: null, averageAnxiety: null };
  }

  const moodScores = logs.map(l => l.mood_score);
  const anxietyScores = logs.filter(l => l.anxiety_level !== null).map(l => l.anxiety_level);

  const avgMood = moodScores.reduce((a, b) => a + b, 0) / moodScores.length;
  const avgAnxiety = anxietyScores.length > 0 
    ? anxietyScores.reduce((a, b) => a + b, 0) / anxietyScores.length 
    : null;

  let trend = 'stable';
  if (moodScores.length >= 3) {
    const recentAvg = (moodScores[0] + moodScores[1]) / 2;
    const olderAvg = (moodScores[moodScores.length - 2] + moodScores[moodScores.length - 1]) / 2;
    if (recentAvg - olderAvg > 0.5) trend = 'improving';
    else if (olderAvg - recentAvg > 0.5) trend = 'declining';
  }

  return { trend, averageMood: Math.round(avgMood * 10) / 10, averageAnxiety: avgAnxiety };
}

async function getLatestMHI(userId: string): Promise<number | null> {
  const user = await getUserById(userId);
  return user?.mental_health_index || null;
}

function calculateAdherenceRate(logs: any[]): number {
  if (logs.length === 0) return 0;
  const taken = logs.filter(l => l.status === 'taken').length;
  return Math.round((taken / logs.length) * 100);
}

function analyzeVoiceInsights(analyses: any[]): any {
  if (analyses.length === 0) {
    return { status: 'insufficient_data', averageVocalHealth: null };
  }

  const avgVocalHealth = analyses.reduce((a, b) => a + b.overall_vocal_health_score, 0) / analyses.length;
  const avgFlatAffect = analyses.reduce((a, b) => a + b.flat_affect_score, 0) / analyses.length;
  const avgAgitation = analyses.reduce((a, b) => a + b.agitated_speech_score, 0) / analyses.length;

  return {
    status: avgVocalHealth > 70 ? 'healthy' : avgVocalHealth > 50 ? 'moderate' : 'concern',
    averageVocalHealth: Math.round(avgVocalHealth),
    averageFlatAffect: Math.round(avgFlatAffect * 100) / 100,
    averageAgitation: Math.round(avgAgitation * 100) / 100,
  };
}

export default router;

