/**
 * Medication Routes
 * Medication schedules, tracking, and adherence
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  getUserById,
  insertMedicationSchedule,
  getMedicationSchedulesByUser,
  insertMedicationLog,
  supabase,
  TABLES,
  MedicationSchedule,
  MedicationLog
} from '../lib/supabase';
import { verifyToken, extractToken } from './auth';

const router = Router();

// Validation schemas
const createMedicationScheduleSchema = z.object({
  medicationName: z.string().min(1, 'Medication name is required'),
  medicationType: z.enum(['pill', 'liquid', 'injection', 'topical', 'other']).default('pill'),
  dosage: z.string().optional(),
  dosageUnit: z.string().optional(),
  frequency: z.enum(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'weekly', 'custom']).default('once_daily'),
  instructions: z.string().optional(),
  timesOfDay: z.array(z.string()).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  prescriberName: z.string().optional(),
  prescriptionDate: z.string().optional(),
  refillsRemaining: z.number().min(0).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
});

const logMedicationSchema = z.object({
  medicationId: z.string().uuid(),
  scheduledTime: z.string(),
  actualTime: z.string().optional(),
  status: z.enum(['taken', 'missed', 'skipped', 'pending']).default('pending'),
  notes: z.string().optional(),
});

const updateMedicationSchema = z.object({
  medicationName: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.enum(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'weekly', 'custom']).optional(),
  instructions: z.string().optional(),
  timesOfDay: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  refillsRemaining: z.number().min(0).optional(),
});

// Create medication schedule
router.post('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const validationResult = createMedicationScheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Determine times based on frequency if not provided
    let timesOfDay = data.timesOfDay;
    if (!timesOfDay || timesOfDay.length === 0) {
      timesOfDay = getDefaultTimes(data.frequency);
    }

    const schedule = await insertMedicationSchedule({
      id: uuidv4(),
      user_id: decoded.userId,
      medication_name: data.medicationName,
      medication_type: data.medicationType,
      dosage: data.dosage,
      dosage_unit: data.dosageUnit,
      frequency: data.frequency,
      instructions: data.instructions,
      times_of_day: timesOfDay,
      days_of_week: data.daysOfWeek,
      prescriber_name: data.prescriberName,
      prescription_date: data.prescriptionDate,
      refills_remaining: data.refillsRemaining,
      is_active: true,
      start_date: data.startDate,
      end_date: data.endDate,
    });

    if (!schedule) {
      return res.status(500).json({ error: 'Failed to create medication schedule' });
    }

    res.status(201).json({
      message: 'Medication schedule created successfully',
      schedule: {
        id: schedule.id,
        medicationName: schedule.medication_name,
        medicationType: schedule.medication_type,
        dosage: schedule.dosage,
        frequency: schedule.frequency,
        timesOfDay: schedule.times_of_day,
        instructions: schedule.instructions,
        isActive: schedule.is_active,
        startDate: schedule.start_date,
      },
      reminders: generateReminders(schedule),
    });
  } catch (error) {
    next(error);
  }
});

// Get all medication schedules
router.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const activeOnly = req.query.activeOnly === 'true';
    const schedules = await getMedicationSchedulesByUser(decoded.userId, activeOnly);

    res.json({
      schedules: schedules.map(s => ({
        id: s.id,
        medicationName: s.medication_name,
        medicationType: s.medication_type,
        dosage: s.dosage,
        dosageUnit: s.dosage_unit,
        frequency: s.frequency,
        instructions: s.instructions,
        timesOfDay: s.times_of_day,
        daysOfWeek: s.days_of_week,
        prescriberName: s.prescriber_name,
        refillsRemaining: s.refills_remaining,
        isActive: s.is_active,
        startDate: s.start_date,
        endDate: s.end_date,
        createdAt: s.created_at,
      })),
      summary: {
        totalMedications: schedules.length,
        activeMedications: schedules.filter(s => s.is_active).length,
        medicationsNeedingRefill: schedules.filter(s => s.refills_remaining != null && s.refills_remaining <= 1).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single medication schedule
router.get('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
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
      .from(TABLES.MEDICATION_SCHEDULES)
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Medication schedule not found' });
    }

    const schedule = data as MedicationSchedule;

    // Get adherence statistics
    const adherence = await calculateAdherence(decoded.userId, id);

    res.json({
      schedule: {
        id: schedule.id,
        medicationName: schedule.medication_name,
        medicationType: schedule.medication_type,
        dosage: schedule.dosage,
        dosageUnit: schedule.dosage_unit,
        frequency: schedule.frequency,
        instructions: schedule.instructions,
        timesOfDay: schedule.times_of_day,
        daysOfWeek: schedule.days_of_week,
        prescriberName: schedule.prescriber_name,
        prescriptionDate: schedule.prescription_date,
        refillsRemaining: schedule.refills_remaining,
        isActive: schedule.is_active,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at,
      },
      adherence,
    });
  } catch (error) {
    next(error);
  }
});

// Update medication schedule
router.put('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const validationResult = updateMedicationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    // Check if schedule exists
    const { data: existing, error: fetchError } = await supabase
      .from(TABLES.MEDICATION_SCHEDULES)
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Medication schedule not found' });
    }

    const updates: Partial<MedicationSchedule> = {};
    const { medicationName, dosage, frequency, instructions, timesOfDay, isActive, refillsRemaining } = validationResult.data;

    if (medicationName) updates.medication_name = medicationName;
    if (dosage) updates.dosage = dosage;
    if (frequency) updates.frequency = frequency;
    if (instructions) updates.instructions = instructions;
    if (timesOfDay) updates.times_of_day = timesOfDay;
    if (isActive !== undefined) updates.is_active = isActive;
    if (refillsRemaining !== undefined) updates.refills_remaining = refillsRemaining;

    const { error: updateError } = await supabase
      .from(TABLES.MEDICATION_SCHEDULES)
      .update(updates)
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update medication schedule' });
    }

    res.json({
      message: 'Medication schedule updated successfully',
      scheduleId: id,
    });
  } catch (error) {
    next(error);
  }
});

// Delete medication schedule
router.delete('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
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
      .from(TABLES.MEDICATION_SCHEDULES)
      .delete()
      .eq('id', id)
      .eq('user_id', decoded.userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete medication schedule' });
    }

    res.json({
      message: 'Medication schedule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Log medication intake
router.post('/log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const validationResult = logMedicationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Verify medication belongs to user
    const { data: medication, error: medError } = await supabase
      .from(TABLES.MEDICATION_SCHEDULES)
      .select('*')
      .eq('id', data.medicationId)
      .eq('user_id', decoded.userId)
      .single();

    if (medError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const log = await insertMedicationLog({
      id: uuidv4(),
      medication_id: data.medicationId,
      scheduled_time: data.scheduledTime,
      actual_time: data.actualTime || new Date().toISOString(),
      status: data.status,
      notes: data.notes,
    });

    if (!log) {
      return res.status(500).json({ error: 'Failed to log medication' });
    }

    res.status(201).json({
      message: 'Medication logged successfully',
      log: {
        id: log.id,
        medicationName: medication.medication_name,
        status: log.status,
        scheduledTime: log.scheduled_time,
        actualTime: log.actual_time,
        notes: log.notes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get medication logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
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
      .from(TABLES.MEDICATION_LOGS)
      .select(`
        *,
        medication:medication_id (
          id,
          medication_name,
          medication_type,
          dosage
        )
      `)
      .eq('medication:medication_id.user_id', decoded.userId)
      .gte('scheduled_time', startDate.toISOString())
      .order('scheduled_time', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch medication logs' });
    }

    // Calculate adherence
    const logs = data as any[];
    const taken = logs.filter(l => l.status === 'taken').length;
    const total = logs.length;
    const adherenceRate = total > 0 ? (taken / total) * 100 : 0;

    res.json({
      logs: logs.map(l => ({
        id: l.id,
        medicationName: l.medication?.medication_name,
        medicationType: l.medication?.medication_type,
        dosage: l.medication?.dosage,
        status: l.status,
        scheduledTime: l.scheduled_time,
        actualTime: l.actual_time,
        notes: l.notes,
      })),
      summary: {
        totalLogs: total,
        taken: taken,
        missed: logs.filter(l => l.status === 'missed').length,
        skipped: logs.filter(l => l.status === 'skipped').length,
        adherenceRate: Math.round(adherenceRate),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get today's medications
router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const schedules = await getMedicationSchedulesByUser(decoded.userId, true);
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Filter medications for today
    const todaysMedications = schedules.filter(s => {
      if (!s.is_active) return false;
      if (s.end_date && new Date(s.end_date) < today) return false;
      if (s.days_of_week && !s.days_of_week.includes(dayOfWeek)) return false;
      return true;
    });

    // Get today's logs
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data: logs, error } = await supabase
      .from(TABLES.MEDICATION_LOGS)
      .select('*')
      .gte('actual_time', todayStart)
      .lte('actual_time', todayEnd);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch today\'s logs' });
    }

    const takenMedicationIds = new Set(logs?.map(l => l.medication_id) || []);

    res.json({
      medications: todaysMedications.map(m => ({
        id: m.id,
        medicationName: m.medication_name,
        medicationType: m.medication_type,
        dosage: m.dosage,
        dosageUnit: m.dosage_unit,
        timesOfDay: m.times_of_day,
        instructions: m.instructions,
        status: takenMedicationIds.has(m.id) ? 'taken' : 'pending',
      })),
      summary: {
        total: todaysMedications.length,
        taken: takenMedicationIds.size,
        remaining: todaysMedications.length - takenMedicationIds.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getDefaultTimes(frequency: string): string[] {
  const times: { [key: string]: string[] } = {
    once_daily: ['08:00'],
    twice_daily: ['08:00', '20:00'],
    three_times_daily: ['08:00', '14:00', '20:00'],
    four_times_daily: ['08:00', '12:00', '16:00', '20:00'],
    weekly: ['08:00'],
  };
  return times[frequency] || ['08:00'];
}

function generateReminders(schedule: MedicationSchedule): string[] {
  const reminders: string[] = [];
  if (schedule.times_of_day) {
    schedule.times_of_day.forEach(time => {
      reminders.push(`Daily reminder at ${time} for ${schedule.medication_name}`);
    });
  }
  return reminders;
}

async function calculateAdherence(userId: string, medicationId: string): Promise<any> {
  const { data: logs, error } = await supabase
    .from(TABLES.MEDICATION_LOGS)
    .select('*')
    .eq('medication_id', medicationId)
    .order('scheduled_time', { ascending: false })
    .limit(30);

  if (error || !logs || logs.length === 0) {
    return { rate: 0, taken: 0, total: 0 };
  }

  const taken = logs.filter((l: any) => l.status === 'taken').length;
  const total = logs.length;

  return {
    rate: Math.round((taken / total) * 100),
    taken,
    total,
    lastTaken: logs.find((l: any) => l.status === 'taken')?.actual_time || null,
  };
}

export default router;

