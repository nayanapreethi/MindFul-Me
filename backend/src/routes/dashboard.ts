import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

/**
 * GET /api/dashboard/overview
 * Get dashboard overview data
 */
router.get(
  '/overview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Get user info
    const userResult = await pool.query(
      `SELECT first_name, last_name, mental_health_index, phq9_score, gad7_score
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = userResult.rows[0];

    // Get recent mood logs (last 7 days)
    const moodLogsResult = await pool.query(
      `SELECT log_date, mood_score, mental_health_index, anxiety_level, stress_level, sleep_quality
       FROM mood_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY log_date DESC`,
      [userId]
    );

    // Calculate trend
    const trend = calculateTrend(moodLogsResult.rows);

    // Get medication stats for today
    const medicationResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending') as scheduled,
         COUNT(*) FILTER (WHERE status = 'taken') as taken,
         COUNT(*) FILTER (WHERE status = 'missed') as missed
       FROM medication_logs ml
       JOIN medication_schedules ms ON ml.medication_id = ms.id
       WHERE ms.user_id = $1 AND DATE(ml.scheduled_time) = CURRENT_DATE`,
      [userId]
    );

    const medications = medicationResult.rows[0] || { scheduled: 0, taken: 0, missed: 0 };

    // Get proactive insights
    const insightsResult = await pool.query(
      `SELECT id, alert_trigger_reason as message, burnout_risk_score, analysis_date
       FROM predictive_insights
       WHERE user_id = $1 AND alert_triggered = TRUE
       ORDER BY analysis_date DESC
       LIMIT 5`,
      [userId]
    );

    const proactiveInsights = insightsResult.rows.map(insight => ({
      id: insight.id,
      type: 'wellness_alert',
      message: insight.message,
      severity: getSeverity(insight.burnout_risk_score),
      date: insight.analysis_date,
    }));

    res.json({
      user: {
        name: `${user.first_name} ${user.last_name}`,
        mentalHealthIndex: parseFloat(user.mental_health_index) || 50,
        phq9Score: user.phq9_score || 0,
        gad7Score: user.gad7_score || 0,
      },
      trend,
      recentMoodLogs: moodLogsResult.rows.map(log => ({
        date: log.log_date,
        moodScore: log.mood_score,
        mentalHealthIndex: parseFloat(log.mental_health_index) || 50,
        anxietyLevel: log.anxiety_level || 0,
        stressLevel: log.stress_level || 0,
        sleepQuality: log.sleep_quality || 5,
      })),
      medications: {
        scheduled: parseInt(medications.scheduled) || 0,
        taken: parseInt(medications.taken) || 0,
        missed: parseInt(medications.missed) || 0,
      },
      proactiveInsights,
    });
  })
);

/**
 * GET /api/dashboard/chart
 * Get chart data for mental health visualization
 */
router.get(
  '/chart',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 7;

    const result = await pool.query(
      `SELECT log_date, mood_score, mental_health_index, anxiety_level, stress_level, sleep_quality
       FROM mood_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL $2 days
       ORDER BY log_date ASC`,
      [userId, days]
    );

    // Generate predicted values (simple moving average + trend)
    const chartData = result.rows.map((log, index, arr) => {
      const predicted = calculatePrediction(arr, index);
      return {
        date: log.log_date,
        actual: parseFloat(log.mental_health_index) || 50,
        predicted,
        mood: log.mood_score,
        anxiety: log.anxiety_level,
        stress: log.stress_level,
        sleep: log.sleep_quality,
      };
    });

    res.json({
      chartData,
      summary: {
        averageMHI: calculateAverage(result.rows, 'mental_health_index'),
        averageMood: calculateAverage(result.rows, 'mood_score'),
        averageAnxiety: calculateAverage(result.rows, 'anxiety_level'),
        averageStress: calculateAverage(result.rows, 'stress_level'),
        averageSleep: calculateAverage(result.rows, 'sleep_quality'),
      },
    });
  })
);

/**
 * POST /api/dashboard/mood
 * Log a new mood entry
 */
router.post(
  '/mood',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = moodLogSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { moodScore, energyLevel, anxietyLevel, stressLevel, sleepQuality, activities, triggers, notes } = validation.data;

    // Get user's baseline scores
    const userResult = await pool.query(
      `SELECT phq9_score, gad7_score FROM users WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    // Calculate Mental Health Index
    const mentalHealthIndex = calculateMHI(
      user.phq9_score || 0,
      user.gad7_score || 0,
      moodScore,
      sleepQuality || 5,
      anxietyLevel || 0
    );

    // Insert mood log
    const result = await pool.query(
      `INSERT INTO mood_logs (
         user_id, mood_score, energy_level, anxiety_level, stress_level, sleep_quality,
         mental_health_index, activities, triggers, log_date, log_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, CURRENT_TIME)
       RETURNING id, mood_score, mental_health_index, log_date, log_time`,
      [
        userId,
        moodScore,
        energyLevel || null,
        anxietyLevel || null,
        stressLevel || null,
        sleepQuality || null,
        mentalHealthIndex,
        activities ? JSON.stringify(activities) : null,
        triggers ? JSON.stringify(triggers) : null,
      ]
    );

    // Update user's mental health index
    await pool.query(
      `UPDATE users SET mental_health_index = $1, updated_at = NOW() WHERE id = $2`,
      [mentalHealthIndex, userId]
    );

    res.status(201).json({
      message: 'Mood logged successfully',
      moodLog: {
        id: result.rows[0].id,
        moodScore: result.rows[0].mood_score,
        mentalHealthIndex: parseFloat(result.rows[0].mental_health_index),
        logDate: result.rows[0].log_date,
        logTime: result.rows[0].log_time,
      },
    });
  })
);

/**
 * GET /api/dashboard/insights
 * Get AI-generated insights
 */
router.get(
  '/insights',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Get recent mood logs for analysis
    const moodLogsResult = await pool.query(
      `SELECT mood_score, anxiety_level, stress_level, sleep_quality, mental_health_index, log_date
       FROM mood_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY log_date DESC`,
      [userId]
    );

    // Generate insights based on data patterns
    const insights = generateInsights(moodLogsResult.rows);

    res.json({ insights });
  })
);

// Helper functions
function calculateTrend(logs: any[]): 'improving' | 'stable' | 'declining' {
  if (logs.length < 2) return 'stable';

  const recent = logs.slice(0, 3);
  const older = logs.slice(3, 6);

  if (recent.length === 0 || older.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, log) => sum + parseFloat(log.mental_health_index || 50), 0) / recent.length;
  const olderAvg = older.reduce((sum, log) => sum + parseFloat(log.mental_health_index || 50), 0) / older.length;

  const diff = recentAvg - olderAvg;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

function getSeverity(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function calculatePrediction(logs: any[], currentIndex: number): number {
  if (currentIndex < 2) return parseFloat(logs[currentIndex]?.mental_health_index || 50);

  // Simple moving average
  const window = logs.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
  const avg = window.reduce((sum, log) => sum + parseFloat(log.mental_health_index || 50), 0) / window.length;

  // Add small random variation for prediction visualization
  return Math.max(0, Math.min(100, avg + (Math.random() - 0.5) * 5));
}

function calculateAverage(logs: any[], field: string): number {
  if (logs.length === 0) return 0;
  const sum = logs.reduce((acc, log) => acc + (parseFloat(log[field]) || 0), 0);
  return Math.round((sum / logs.length) * 10) / 10;
}

function calculateMHI(phq9: number, gad7: number, mood: number, sleep: number, anxiety: number): number {
  // MHI = 100 - (PHQ-9 × 2 + GAD-7 × 2 + (10-mood) × 3 + (10-sleep) × 1.5 + anxiety × 1.5)
  const mhi = 100 - (
    phq9 * 2 +
    gad7 * 2 +
    (10 - mood) * 3 +
    (10 - sleep) * 1.5 +
    anxiety * 1.5
  );
  return Math.max(0, Math.min(100, Math.round(mhi * 100) / 100));
}

function generateInsights(logs: any[]): Array<{ type: string; message: string; priority: string }> {
  const insights: Array<{ type: string; message: string; priority: string }> = [];

  if (logs.length === 0) {
    insights.push({
      type: 'onboarding',
      message: 'Start logging your mood daily to receive personalized insights.',
      priority: 'medium',
    });
    return insights;
  }

  // Analyze sleep patterns
  const avgSleep = calculateAverage(logs, 'sleep_quality');
  if (avgSleep < 5) {
    insights.push({
      type: 'sleep',
      message: 'Your sleep quality has been below average. Consider establishing a consistent bedtime routine.',
      priority: 'high',
    });
  }

  // Analyze anxiety trends
  const avgAnxiety = calculateAverage(logs, 'anxiety_level');
  if (avgAnxiety > 6) {
    insights.push({
      type: 'anxiety',
      message: 'Your anxiety levels have been elevated. Try breathing exercises or mindfulness meditation.',
      priority: 'high',
    });
  }

  // Analyze mood patterns
  const avgMood = calculateAverage(logs, 'mood_score');
  if (avgMood >= 7) {
    insights.push({
      type: 'positive',
      message: 'Great job! Your mood has been consistently positive. Keep up the good work!',
      priority: 'low',
    });
  }

  // Check for consistency
  if (logs.length >= 7) {
    insights.push({
      type: 'consistency',
      message: 'You\'ve been consistent with your mood logging. This helps us provide better insights.',
      priority: 'low',
    });
  }

  return insights;
}

export default router;
