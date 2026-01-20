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
const medicationSchema = z.object({
  medicationName: z.string().min(1, 'Medication name is required'),
  medicationType: z.enum(['pill', 'liquid', 'injection', 'topical', 'inhaler', 'other']).optional(),
  dosage: z.string().optional(),
  dosageUnit: z.string().optional(),
  frequency: z.enum(['daily', 'twice_daily', 'three_times_daily', 'weekly', 'as_needed']).default('daily'),
  instructions: z.string().optional(),
  timesOfDay: z.array(z.string()).optional(), // Array of time strings like "08:00", "20:00"
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday, 6 = Saturday
  prescriberName: z.string().optional(),
  prescriptionDate: z.string().optional(),
  refillsRemaining: z.number().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
});

const logMedicationSchema = z.object({
  status: z.enum(['taken', 'missed', 'skipped']),
  actualTime: z.string().optional(),
  notes: z.string().optional(),
  moodCorrelationNotes: z.string().optional(),
});

/**
 * GET /api/medication
 * Get all medications for the user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const activeOnly = req.query.active === 'true';

    let query = `
      SELECT id, medication_name, medication_type, dosage, dosage_unit, frequency,
             instructions, times_of_day, days_of_week, prescriber_name,
             prescription_date, refills_remaining, is_active, start_date, end_date,
             created_at, updated_at
      FROM medication_schedules
      WHERE user_id = $1
    `;

    if (activeOnly) {
      query += ` AND is_active = TRUE`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, [userId]);

    res.json({
      medications: result.rows.map(med => ({
        id: med.id,
        medicationName: med.medication_name,
        medicationType: med.medication_type,
        dosage: med.dosage,
        dosageUnit: med.dosage_unit,
        frequency: med.frequency,
        instructions: med.instructions,
        timesOfDay: med.times_of_day,
        daysOfWeek: med.days_of_week,
        prescriberName: med.prescriber_name,
        prescriptionDate: med.prescription_date,
        refillsRemaining: med.refills_remaining,
        isActive: med.is_active,
        startDate: med.start_date,
        endDate: med.end_date,
        createdAt: med.created_at,
        updatedAt: med.updated_at,
      })),
    });
  })
);

/**
 * GET /api/medication/:id
 * Get a specific medication
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const medicationId = req.params.id;

    const result = await pool.query(
      `SELECT id, medication_name, medication_type, dosage, dosage_unit, frequency,
              instructions, times_of_day, days_of_week, prescriber_name,
              prescription_date, refills_remaining, is_active, start_date, end_date,
              created_at, updated_at
       FROM medication_schedules
       WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Medication');
    }

    const med = result.rows[0];

    res.json({
      id: med.id,
      medicationName: med.medication_name,
      medicationType: med.medication_type,
      dosage: med.dosage,
      dosageUnit: med.dosage_unit,
      frequency: med.frequency,
      instructions: med.instructions,
      timesOfDay: med.times_of_day,
      daysOfWeek: med.days_of_week,
      prescriberName: med.prescriber_name,
      prescriptionDate: med.prescription_date,
      refillsRemaining: med.refills_remaining,
      isActive: med.is_active,
      startDate: med.start_date,
      endDate: med.end_date,
      createdAt: med.created_at,
      updatedAt: med.updated_at,
    });
  })
);

/**
 * POST /api/medication
 * Create a new medication schedule
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = medicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const {
      medicationName, medicationType, dosage, dosageUnit, frequency,
      instructions, timesOfDay, daysOfWeek, prescriberName,
      prescriptionDate, refillsRemaining, startDate, endDate
    } = validation.data;

    const result = await pool.query(
      `INSERT INTO medication_schedules (
         user_id, medication_name, medication_type, dosage, dosage_unit, frequency,
         instructions, times_of_day, days_of_week, prescriber_name,
         prescription_date, refills_remaining, start_date, end_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, medication_name, frequency, start_date, created_at`,
      [
        userId,
        medicationName,
        medicationType || null,
        dosage || null,
        dosageUnit || null,
        frequency,
        instructions || null,
        timesOfDay ? `{${timesOfDay.join(',')}}` : null,
        daysOfWeek ? `{${daysOfWeek.join(',')}}` : null,
        prescriberName || null,
        prescriptionDate || null,
        refillsRemaining || null,
        startDate,
        endDate || null,
      ]
    );

    // Create initial medication logs for today if applicable
    if (timesOfDay && timesOfDay.length > 0) {
      for (const time of timesOfDay) {
        await pool.query(
          `INSERT INTO medication_logs (medication_id, scheduled_time, status)
           VALUES ($1, CURRENT_DATE + $2::TIME, 'pending')`,
          [result.rows[0].id, time]
        );
      }
    }

    res.status(201).json({
      message: 'Medication schedule created successfully',
      medication: {
        id: result.rows[0].id,
        medicationName: result.rows[0].medication_name,
        frequency: result.rows[0].frequency,
        startDate: result.rows[0].start_date,
        createdAt: result.rows[0].created_at,
      },
    });
  })
);

/**
 * PUT /api/medication/:id
 * Update a medication schedule
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const medicationId = req.params.id;

    // Check if medication exists
    const existing = await pool.query(
      `SELECT id FROM medication_schedules WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Medication');
    }

    const validation = medicationSchema.partial().safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      medicationName: 'medication_name',
      medicationType: 'medication_type',
      dosage: 'dosage',
      dosageUnit: 'dosage_unit',
      frequency: 'frequency',
      instructions: 'instructions',
      prescriberName: 'prescriber_name',
      prescriptionDate: 'prescription_date',
      refillsRemaining: 'refills_remaining',
      startDate: 'start_date',
      endDate: 'end_date',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((validation.data as any)[key] !== undefined) {
        updates.push(`${dbField} = $${paramIndex++}`);
        values.push((validation.data as any)[key]);
      }
    }

    // Handle array fields specially
    if (validation.data.timesOfDay !== undefined) {
      updates.push(`times_of_day = $${paramIndex++}`);
      values.push(`{${validation.data.timesOfDay.join(',')}}`);
    }

    if (validation.data.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(`{${validation.data.daysOfWeek.join(',')}}`);
    }

    if (updates.length === 0) {
      res.json({ message: 'No changes made' });
      return;
    }

    values.push(medicationId, userId);

    const result = await pool.query(
      `UPDATE medication_schedules SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, medication_name, updated_at`,
      values
    );

    res.json({
      message: 'Medication updated successfully',
      medication: {
        id: result.rows[0].id,
        medicationName: result.rows[0].medication_name,
        updatedAt: result.rows[0].updated_at,
      },
    });
  })
);

/**
 * DELETE /api/medication/:id
 * Delete a medication schedule
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const medicationId = req.params.id;

    const result = await pool.query(
      `DELETE FROM medication_schedules WHERE id = $1 AND user_id = $2 RETURNING id`,
      [medicationId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Medication');
    }

    res.json({ message: 'Medication deleted successfully' });
  })
);

/**
 * POST /api/medication/:id/log
 * Log medication intake
 */
router.post(
  '/:id/log',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const medicationId = req.params.id;

    // Verify medication belongs to user
    const medResult = await pool.query(
      `SELECT id FROM medication_schedules WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    if (medResult.rows.length === 0) {
      throw new NotFoundError('Medication');
    }

    const validation = logMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Validation failed',
        validation.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      );
    }

    const { status, actualTime, notes, moodCorrelationNotes } = validation.data;

    const result = await pool.query(
      `INSERT INTO medication_logs (
         medication_id, scheduled_time, actual_time, status, notes, mood_correlation_notes
       ) VALUES ($1, NOW(), $2, $3, $4, $5)
       RETURNING id, status, actual_time, created_at`,
      [
        medicationId,
        actualTime ? new Date(actualTime) : new Date(),
        status,
        notes || null,
        moodCorrelationNotes || null,
      ]
    );

    res.status(201).json({
      message: 'Medication logged successfully',
      log: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        actualTime: result.rows[0].actual_time,
        createdAt: result.rows[0].created_at,
      },
    });
  })
);

/**
 * GET /api/medication/:id/logs
 * Get medication logs for a specific medication
 */
router.get(
  '/:id/logs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const medicationId = req.params.id;
    const days = parseInt(req.query.days as string) || 30;

    // Verify medication belongs to user
    const medResult = await pool.query(
      `SELECT id FROM medication_schedules WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    if (medResult.rows.length === 0) {
      throw new NotFoundError('Medication');
    }

    const result = await pool.query(
      `SELECT id, scheduled_time, actual_time, status, notes, mood_correlation_notes, created_at
       FROM medication_logs
       WHERE medication_id = $1 AND created_at >= CURRENT_DATE - INTERVAL $2 days
       ORDER BY scheduled_time DESC`,
      [medicationId, days]
    );

    res.json({
      logs: result.rows.map(log => ({
        id: log.id,
        scheduledTime: log.scheduled_time,
        actualTime: log.actual_time,
        status: log.status,
        notes: log.notes,
        moodCorrelationNotes: log.mood_correlation_notes,
        createdAt: log.created_at,
      })),
    });
  })
);

/**
 * GET /api/medication/today
 * Get today's medication schedule
 */
router.get(
  '/today',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT ms.id, ms.medication_name, ms.dosage, ms.dosage_unit, ms.times_of_day,
              ml.id as log_id, ml.scheduled_time, ml.actual_time, ml.status
       FROM medication_schedules ms
       LEFT JOIN medication_logs ml ON ms.id = ml.medication_id 
         AND DATE(ml.scheduled_time) = CURRENT_DATE
       WHERE ms.user_id = $1 AND ms.is_active = TRUE
       ORDER BY ml.scheduled_time ASC`,
      [userId]
    );

    // Group by medication
    const medicationsMap = new Map();
    for (const row of result.rows) {
      if (!medicationsMap.has(row.id)) {
        medicationsMap.set(row.id, {
          id: row.id,
          medicationName: row.medication_name,
          dosage: row.dosage,
          dosageUnit: row.dosage_unit,
          timesOfDay: row.times_of_day,
          logs: [],
        });
      }
      if (row.log_id) {
        medicationsMap.get(row.id).logs.push({
          id: row.log_id,
          scheduledTime: row.scheduled_time,
          actualTime: row.actual_time,
          status: row.status,
        });
      }
    }

    res.json({
      medications: Array.from(medicationsMap.values()),
    });
  })
);

/**
 * GET /api/medication/adherence
 * Get medication adherence statistics
 */
router.get(
  '/adherence',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const result = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE ml.status = 'taken') as taken,
         COUNT(*) FILTER (WHERE ml.status = 'missed') as missed,
         COUNT(*) FILTER (WHERE ml.status = 'skipped') as skipped,
         COUNT(*) as total
       FROM medication_logs ml
       JOIN medication_schedules ms ON ml.medication_id = ms.id
       WHERE ms.user_id = $1 AND ml.created_at >= CURRENT_DATE - INTERVAL $2 days`,
      [userId, days]
    );

    const stats = result.rows[0];
    const adherenceRate = stats.total > 0 
      ? Math.round((parseInt(stats.taken) / parseInt(stats.total)) * 100) 
      : 0;

    res.json({
      adherence: {
        taken: parseInt(stats.taken) || 0,
        missed: parseInt(stats.missed) || 0,
        skipped: parseInt(stats.skipped) || 0,
        total: parseInt(stats.total) || 0,
        adherenceRate,
      },
      period: `${days} days`,
    });
  })
);

export default router;
