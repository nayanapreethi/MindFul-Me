/**
 * Supabase Client Configuration
 * MindfulMe Backend - Database & Auth Integration
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase environment variables not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
}

// Create Supabase client for regular operations (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create Supabase admin client (service role key) - for server-side operations
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Database table names
export const TABLES = {
  USERS: 'users',
  MOOD_LOGS: 'mood_logs',
  JOURNAL_ENTRIES: 'journal_entries',
  VOICE_BIOMETRICS: 'voice_biometrics',
  MEDICATION_SCHEDULES: 'medication_schedules',
  MEDICATION_LOGS: 'medication_logs',
  BEHAVIORAL_DATA: 'behavioral_data',
  PREDICTIVE_INSIGHTS: 'predictive_insights',
  DOCTORS: 'doctors',
  DOCTOR_CONNECTIONS: 'doctor_connections',
  REFRESH_TOKENS: 'refresh_tokens',
  AUDIT_LOGS: 'audit_logs',
} as const;

// Type definitions
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  profile_picture_url?: string;
  phq9_score?: number;
  gad7_score?: number;
  mental_health_index?: number;
  biometric_enabled?: boolean;
  two_factor_enabled?: boolean;
  consent_given?: boolean;
  consent_timestamp?: string;
  created_at: string;
  updated_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood_score: number;
  energy_level?: number;
  anxiety_level?: number;
  stress_level?: number;
  sleep_quality?: number;
  mental_health_index?: number;
  activities?: Record<string, unknown>;
  triggers?: string[];
  ai_insights?: Record<string, unknown>;
  sentiment_score?: number;
  is_crisis?: boolean;
  crisis_type?: string;
  log_date: string;
  log_time: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  encrypted_content: string;
  encryption_iv: string;
  encryption_key_id?: string;
  title?: string;
  entry_type: string;
  is_shared_with_doctor: boolean;
  sentiment_analysis?: Record<string, unknown>;
  emotion_tags?: Record<string, number>;
  key_phrases?: string[];
  ai_recommendations?: string[];
  current_sentiment_score?: number;
  emotional_insights?: string[];
  created_at: string;
  updated_at: string;
}

export interface VoiceBiometrics {
  id: string;
  user_id: string;
  encrypted_audio_path?: string;
  encryption_key_id?: string;
  pitch_features: Record<string, unknown>;
  jitter_features?: Record<string, unknown>;
  shimmer_features?: Record<string, unknown>;
  cadence_features: Record<string, unknown>;
  intensity_features?: Record<string, unknown>;
  flat_affect_score?: number;
  agitated_speech_score?: number;
  overall_vocal_health_score?: number;
  detected_anomalies?: string[];
  requires_clinical_review?: boolean;
  recording_duration_seconds?: number;
  created_at: string;
}

export interface MedicationSchedule {
  id: string;
  user_id: string;
  medication_name: string;
  medication_type?: string;
  dosage?: string;
  dosage_unit?: string;
  frequency?: string;
  instructions?: string;
  times_of_day?: string[];
  days_of_week?: number[];
  prescriber_name?: string;
  prescription_date?: string;
  refills_remaining?: number;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  actual_time?: string;
  status: string;
  notes?: string;
  mood_correlation_notes?: string;
  created_at: string;
}

export interface BehavioralData {
  id: string;
  user_id: string;
  sleep_duration_hours?: number;
  sleep_quality_score?: number;
  deep_sleep_hours?: number;
  rem_sleep_hours?: number;
  sleep_heart_rate_avg?: number;
  steps_count?: number;
  active_minutes?: number;
  calories_burned?: number;
  distance_km?: number;
  hrv_ms?: number;
  resting_heart_rate?: number;
  heart_rate_variability_data?: Record<string, unknown>;
  source: string;
  data_date: string;
  data_timestamp: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  license_number: string;
  specialization?: string;
  license_state?: string;
  npi_number?: string;
  is_verified: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DoctorConnection {
  id: string;
  patient_id: string;
  doctor_id: string;
  access_token: string;
  token_expires_at: string;
  is_active: boolean;
  revoked_at?: string;
  revocation_reason?: string;
  permissions: Record<string, boolean>;
  last_accessed_at?: string;
  access_count: number;
  created_at: string;
}

export interface PredictiveInsight {
  id: string;
  user_id: string;
  burnout_risk_score?: number;
  anxiety_trend_prediction?: Record<string, unknown>;
  mood_trend_prediction?: Record<string, unknown>;
  proactive_wellness_insight?: Record<string, unknown>[];
  alert_triggered: boolean;
  alert_trigger_reason?: string;
  model_version?: string;
  prediction_confidence?: number;
  analysis_date: string;
  created_at: string;
}

// Helper functions
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  
  return data as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user by email:', error);
    return null;
  }
  
  return data as User;
}

export async function createUser(userData: Partial<User>): Promise<User | null> {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .insert(userData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  
  return data as User;
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating user:', error);
    return null;
  }
  
  return data as User;
}

export async function insertMoodLog(log: Partial<MoodLog>): Promise<MoodLog | null> {
  const { data, error } = await supabase
    .from(TABLES.MOOD_LOGS)
    .insert(log)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting mood log:', error);
    return null;
  }
  
  return data as MoodLog;
}

export async function getMoodLogsByUser(
  userId: string, 
  limit: number = 30
): Promise<MoodLog[]> {
  const { data, error } = await supabase
    .from(TABLES.MOOD_LOGS)
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .order('log_time', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching mood logs:', error);
    return [];
  }
  
  return data as MoodLog[];
}

export async function insertJournalEntry(entry: Partial<JournalEntry>): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from(TABLES.JOURNAL_ENTRIES)
    .insert(entry)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting journal entry:', error);
    return null;
  }
  
  return data as JournalEntry;
}

export async function getJournalEntriesByUser(
  userId: string,
  limit: number = 50
): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from(TABLES.JOURNAL_ENTRIES)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }
  
  return data as JournalEntry[];
}

export async function insertVoiceBiometrics(biometrics: Partial<VoiceBiometrics>): Promise<VoiceBiometrics | null> {
  const { data, error } = await supabase
    .from(TABLES.VOICE_BIOMETRICS)
    .insert(biometrics)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting voice biometrics:', error);
    return null;
  }
  
  return data as VoiceBiometrics;
}

export async function insertMedicationSchedule(schedule: Partial<MedicationSchedule>): Promise<MedicationSchedule | null> {
  const { data, error } = await supabase
    .from(TABLES.MEDICATION_SCHEDULES)
    .insert(schedule)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting medication schedule:', error);
    return null;
  }
  
  return data as MedicationSchedule;
}

export async function getMedicationSchedulesByUser(
  userId: string,
  activeOnly: boolean = true
): Promise<MedicationSchedule[]> {
  let query = supabase
    .from(TABLES.MEDICATION_SCHEDULES)
    .select('*')
    .eq('user_id', userId);
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching medication schedules:', error);
    return [];
  }
  
  return data as MedicationSchedule[];
}

export async function insertMedicationLog(log: Partial<MedicationLog>): Promise<MedicationLog | null> {
  const { data, error } = await supabase
    .from(TABLES.MEDICATION_LOGS)
    .insert(log)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting medication log:', error);
    return null;
  }
  
  return data as MedicationLog;
}

export async function insertDoctorConnection(connection: Partial<DoctorConnection>): Promise<DoctorConnection | null> {
  const { data, error } = await supabase
    .from(TABLES.DOCTOR_CONNECTIONS)
    .insert(connection)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting doctor connection:', error);
    return null;
  }
  
  return data as DoctorConnection;
}

export async function getDoctorConnectionByToken(
  accessToken: string
): Promise<DoctorConnection | null> {
  const { data, error } = await supabase
    .from(TABLES.DOCTOR_CONNECTIONS)
    .select('*')
    .eq('access_token', accessToken)
    .eq('is_active', true)
    .gt('token_expires_at', new Date().toISOString())
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching doctor connection:', error);
    return null;
  }
  
  return data as DoctorConnection;
}

export async function updateDoctorConnection(
  connectionId: string,
  updates: Partial<DoctorConnection>
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.DOCTOR_CONNECTIONS)
    .update(updates)
    .eq('id', connectionId);
  
  if (error) {
    console.error('Error updating doctor connection:', error);
  }
}

export async function insertAuditLog(log: {
  user_id?: string;
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}): Promise<void> {
  const { error } = await supabase
    .from(TABLES.AUDIT_LOGS)
    .insert(log);
  
  if (error) {
    console.error('Error inserting audit log:', error);
  }
}

export default supabase;

