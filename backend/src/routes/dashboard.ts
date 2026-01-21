/**
 * Dashboard Routes
 * Mood tracking, behavioral data, Mental Health Index
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  getUserById, 
  updateUser,
  insertMoodLog, 
  getMoodLogsByUser,
  getJournalEntriesByUser,
  insertJournalEntry,
  TABLES,
  supabase,
  MoodLog,
  User
} from '../lib/supabase';
import { verifyToken, extractToken } from './auth';

const router = Router();

// Validation schemas
const moodLogSchema = z.object({
  moodScore: z.number().min(1).max(10),
  energyLevel: z.number().min(1).max(10).optional(),
  anxietyLevel: z.number().min(0).max(10).optional(),
  stressLevel: z.number().min(0).max(10).optional(),
  sleepQuality: z.number().min(1).max(10).optional(),
  activities: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const behavioralDataSchema = z.object({
  sleepDurationHours: z.number().min(0).max(24).optional(),
  sleepQualityScore: z.number().min(1).max(10).optional(),
  deepSleepHours: z.number().min(0).max(12).optional(),
  remSleepHours: z.number().min(0).max(12).optional(),
  sleepHeartRateAvg: z.number().optional(),
  stepsCount: z.number().optional(),
  activeMinutes: z.number().optional(),
  caloriesBurned: z.number().optional(),
  distanceKm: z.number().optional(),
  hrvMs: z.number().optional(),
  restingHeartRate: z.number().optional(),
  source: z.string().default('manual'),
});

// Calculate Mental Health Index
function calculateMHI(
  phq9: number, 
  gad7: number, 
  mood: number, 
  sleep: number, 
  anxiety: number
): number {
  // MHI = 100 - (PHQ-9 × 2 + GAD-7 × 2 + (10-mood) × 3 + (10-sleep) × 1.5 + anxiety × 1.5)
  const mhi = 100 - (
    phq9 * 2.0 + 
    gad7 * 2.0 + 
    (10 - mood) * 3.0 + 
    (10 - sleep) * 1.5 + 
    anxiety * 1.5
  );
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, mhi));
}

// Get dashboard overview
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
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

    // Get recent mood logs (last 7 days)
    const recentLogs = await getMoodLogsByUser(decoded.userId, 7);

    // Calculate trends
    const moodScores = recentLogs.map(log => log.mood_score);
    const avgMood = moodScores.length > 0 
      ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length 
      : 5;

    const anxietyScores = recentLogs
      .filter(log => log.anxiety_level !== null && log.anxiety_level !== undefined)
      .map(log => log.anxiety_level!);
    const avgAnxiety = anxietyScores.length > 0 
      ? anxietyScores.reduce((a, b) => a + b, 0) / anxietyScores.length 
      : 0;

    const sleepScores = recentLogs
      .filter(log => log.sleep_quality !== null && log.sleep_quality !== undefined)
      .map(log => log.sleep_quality!);
    const avgSleep = sleepScores.length > 0 
      ? sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length 
      : 5;

    // Determine trend direction
    let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (moodScores.length >= 3) {
      const recentAvg = (moodScores[0] + moodScores[1]) / 2;
      const olderAvg = (moodScores[moodScores.length - 2] + moodScores[moodScores.length - 1]) / 2;
      if (recentAvg - olderAvg > 0.5) moodTrend = 'improving';
      else if (olderAvg - recentAvg > 0.5) moodTrend = 'declining';
    }

    res.json({
      mentalHealthIndex: user.mental_health_index || 50,
      moodScore: avgMood,
      anxietyLevel: avgAnxiety,
      sleepQuality: avgSleep,
      energyLevel: recentLogs[0]?.energy_level || 5,
      trends: {
        mood: moodTrend,
        anxiety: avgAnxiety > 5 ? 'elevated' : 'normal',
        sleep: avgSleep > 5 ? 'good' : 'needs_improvement',
      },
      recentLogs: recentLogs.slice(0, 5),
      streak: await calculateStreak(decoded.userId),
    });
  } catch (error) {
    next(error);
  }
});

// Log mood entry
router.post('/mood', async (req: Request, res: Response, next: NextFunction) => {
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
    const validationResult = moodLogSchema.safeParse(req.body);
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

    // Calculate MHI
    const mhi = calculateMHI(
      user.phq9_score || 0,
      user.gad7_score || 0,
      data.moodScore,
      data.sleepQuality || 5,
      data.anxietyLevel || 0
    );

    // Check for crisis
    const isCrisis: boolean = data.moodScore <= 2 || (data.anxietyLevel && data.anxietyLevel >= 9) || false;

    // Insert mood log
    const moodLog = await insertMoodLog({
      id: undefined, // Will be auto-generated
      user_id: decoded.userId,
      mood_score: data.moodScore,
      energy_level: data.energyLevel,
      anxiety_level: data.anxietyLevel,
      stress_level: data.stressLevel,
      sleep_quality: data.sleepQuality,
      mental_health_index: mhi,
      activities: data.activities ? { list: data.activities } : undefined,
      triggers: data.triggers,
      ai_insights: { generated: false },
      is_crisis: isCrisis,
      crisis_type: isCrisis ? (data.moodScore <= 2 ? 'low_mood' : 'high_anxiety') : undefined,
      log_date: new Date().toISOString().split('T')[0],
      log_time: new Date().toISOString().split('T')[1].split('.')[0],
    });

    if (!moodLog) {
      return res.status(500).json({ error: 'Failed to log mood' });
    }

    // Update user's MHI
    await updateUser(decoded.userId, { mental_health_index: mhi });

    res.status(201).json({
      message: 'Mood logged successfully',
      moodLog: {
        id: moodLog.id,
        moodScore: moodLog.mood_score,
        mentalHealthIndex: moodLog.mental_health_index,
        isCrisis: moodLog.is_crisis,
        logDate: moodLog.log_date,
      },
      mentalHealthIndex: mhi,
      crisisAlert: isCrisis ? {
        type: isCrisis ? 'CRisisAlert' : null,
        message: isCrisis 
          ? 'Your entry suggests you may be struggling. Consider reaching out for support.'
          : null,
        resources: isCrisis ? [
          { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
          { name: 'National Suicide Prevention Lifeline', contact: '988' },
        ] : [],
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Get mood history
router.get('/mood/history', async (req: Request, res: Response, next: NextFunction) => {
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
    const logs = await getMoodLogsByUser(decoded.userId, limit);

    // Calculate weekly averages
    const weeklyData = calculateWeeklyAverages(logs);

    res.json({
      logs,
      summary: {
        totalEntries: logs.length,
        averageMood: calculateAverage(logs.map(l => l.mood_score)),
        averageAnxiety: calculateAverage(logs.map(l => l.anxiety_level).filter((v): v is number => v !== null && v !== undefined)),
        averageSleep: calculateAverage(logs.map(l => l.sleep_quality).filter((v): v is number => v !== null && v !== undefined)),
        weeklyAverages: weeklyData,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Submit behavioral data (HealthKit/Google Fit)
router.post('/behavioral', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const validationResult = behavioralDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;
    const now = new Date();

    const behavioralData = {
      id: undefined,
      user_id: decoded.userId,
      sleep_duration_hours: data.sleepDurationHours,
      sleep_quality_score: data.sleepQualityScore,
      deep_sleep_hours: data.deepSleepHours,
      rem_sleep_hours: data.remSleepHours,
      sleep_heart_rate_avg: data.sleepHeartRateAvg,
      steps_count: data.stepsCount,
      active_minutes: data.activeMinutes,
      calories_burned: data.caloriesBurned,
      distance_km: data.distanceKm,
      hrv_ms: data.hrvMs,
      resting_heart_rate: data.restingHeartRate,
      source: data.source,
      data_date: now.toISOString().split('T')[0],
      data_timestamp: now.toISOString(),
    };

    const { error } = await supabase
      .from(TABLES.BEHAVIORAL_DATA)
      .insert(behavioralData);

    if (error) {
      return res.status(500).json({ error: 'Failed to save behavioral data' });
    }

    res.status(201).json({
      message: 'Behavioral data saved successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get behavioral data
router.get('/behavioral', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from(TABLES.BEHAVIORAL_DATA)
      .select('*')
      .eq('user_id', decoded.userId)
      .gte('data_date', startDate.toISOString().split('T')[0])
      .order('data_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch behavioral data' });
    }

    // Calculate averages
    const sleepData = data.filter(d => d.sleep_duration_hours);
    const activityData = data.filter(d => d.steps_count);

    res.json({
      data,
      summary: {
        averageSleep: sleepData.length > 0 
          ? sleepData.reduce((a, b) => a + (b.sleep_duration_hours || 0), 0) / sleepData.length 
          : null,
        averageSteps: activityData.length > 0 
          ? activityData.reduce((a, b) => a + (b.steps_count || 0), 0) / activityData.length 
          : null,
        totalDays: data.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function calculateStreak(userId: string): Promise<number> {
  const logs = await getMoodLogsByUser(userId, 60);
  if (logs.length === 0) return 0;

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  for (let i = 0; i < 60; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasLog = logs.some(log => log.log_date === dateStr);
    
    if (hasLog) {
      streak++;
    } else if (i > 0) {
      // Allow missing today if no log yet
      if (dateStr === today) continue;
      break;
    }
    
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface WeeklyAverage {
  week: string;
  avgMood: number;
  avgAnxiety: number;
  avgSleep: number;
}

function calculateWeeklyAverages(logs: MoodLog[]): WeeklyAverage[] {
  const weeks: { [key: string]: { mood: number[]; anxiety: number[]; sleep: number[]; count: number } } = {};
  
  logs.forEach(log => {
    const date = new Date(log.log_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = { mood: [], anxiety: [], sleep: [], count: 0 };
    }
    
    weeks[weekKey].mood.push(log.mood_score);
    if (log.anxiety_level) weeks[weekKey].anxiety.push(log.anxiety_level);
    if (log.sleep_quality) weeks[weekKey].sleep.push(log.sleep_quality);
    weeks[weekKey].count++;
  });

  return Object.entries(weeks)
    .map(([week, data]) => ({
      week,
      avgMood: data.mood.length > 0 ? data.mood.reduce((a, b) => a + b, 0) / data.mood.length : 0,
      avgAnxiety: data.anxiety.length > 0 ? data.anxiety.reduce((a, b) => a + b, 0) / data.anxiety.length : 0,
      avgSleep: data.sleep.length > 0 ? data.sleep.reduce((a, b) => a + b, 0) / data.sleep.length : 0,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-4);
}

export default router;

