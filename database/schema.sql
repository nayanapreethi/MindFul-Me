-- MindfulMe Database Schema
-- PostgreSQL with E2E encryption support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone_number VARCHAR(20),
    profile_picture_url TEXT,
    
    -- Clinical Baseline (PHQ-9 & GAD-7)
    phq9_score INTEGER DEFAULT 0,
    gad7_score INTEGER DEFAULT 0,
    mental_health_index DECIMAL(5,2) DEFAULT 50.00,
    
    -- Preferences
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
    accessibility_settings JSONB DEFAULT '{"highContrast": false, "screenReader": false, "fontSize": "medium"}'::jsonb,
    theme_preferences JSONB DEFAULT '{"mode": "light", "glassmorphism": true}'::jsonb,
    
    -- Security
    biometric_enabled BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- HIPAA Compliance
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMP,
    data_retention_days INTEGER DEFAULT 2555, -- 7 years
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_mental_health_index ON users(mental_health_index);

-- ============================================
-- DOCTORS TABLE
-- ============================================
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    specialization VARCHAR(100),
    license_state VARCHAR(50),
    npi_number VARCHAR(20),
    practice_address TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verification_documents JSONB,
    verified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- DOCTOR CONNECTIONS (Access Tokens)
-- ============================================
CREATE TABLE doctor_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    
    -- Time-limited, revocable token
    access_token VARCHAR(500) NOT NULL,
    token_expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    
    -- Permissions
    permissions JSONB DEFAULT '{
        "view_mood_logs": true,
        "view_journal_entries": true,
        "view_voice_analysis": true,
        "view_medication_logs": true,
        "view_behavioral_data": true,
        "export_data": false
    }'::jsonb,
    
    -- Access tracking
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_doctor_connections_patient ON doctor_connections(patient_id);
CREATE INDEX idx_doctor_connections_doctor ON doctor_connections(doctor_id);
CREATE INDEX idx_doctor_connections_token ON doctor_connections(access_token);

-- ============================================
-- MOOD LOGS
-- ============================================
CREATE TABLE mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core metrics
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    anxiety_level INTEGER CHECK (anxiety_level BETWEEN 0 AND 10),
    stress_level INTEGER CHECK (stress_level BETWEEN 0 AND 10),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    
    -- Mental Health Index calculation
    mental_health_index DECIMAL(5,2),
    
    -- Context
    activities JSONB,
    triggers JSONB,
    location_data JSONB,
    weather_data JSONB,
    
    -- AI Analysis
    ai_insights JSONB,
    sentiment_score DECIMAL(5,4),
    
    -- Flags
    is_crisis BOOLEAN DEFAULT FALSE,
    crisis_type VARCHAR(50),
    
    log_date DATE NOT NULL,
    log_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mood_logs_user ON mood_logs(user_id);
CREATE INDEX idx_mood_logs_date ON mood_logs(log_date);
CREATE INDEX idx_mood_logs_crisis ON mood_logs(is_crisis);

-- ============================================
-- JOURNAL ENTRIES (E2E Encrypted)
-- ============================================
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Encrypted content (AES-256)
    encrypted_content TEXT NOT NULL,
    encryption_iv VARCHAR(64) NOT NULL,
    encryption_key_id VARCHAR(100),
    
    -- Metadata
    title VARCHAR(255),
    entry_type VARCHAR(50) DEFAULT 'general', -- 'gratitude', 'reflection', 'free_write'
    is_shared_with_doctor BOOLEAN DEFAULT FALSE,
    
    -- AI Analysis (stored decrypted for analysis)
    sentiment_analysis JSONB,
    emotion_tags JSONB,
    key_phrases JSONB,
    ai_recommendations JSONB,
    
    -- Real-time insights
    current_sentiment_score DECIMAL(5,4),
    emotional_insights JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_user ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_shared ON journal_entries(is_shared_with_doctor);

-- ============================================
-- VOICE BIOMETRICS (E2E Encrypted)
-- ============================================
CREATE TABLE voice_biometrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Encrypted audio reference
    encrypted_audio_path VARCHAR(500),
    encryption_key_id VARCHAR(100),
    
    -- Vocal Features (extracted from audio)
    pitch_features JSONB NOT NULL,
    jitter_features JSONB,
    shimmer_features JSONB,
    cadence_features JSONB NOT NULL,
    intensity_features JSONB,
    
    -- Analysis Results
    flat_affect_score DECIMAL(5,4),
    agitated_speech_score DECIMAL(5,4),
    overall_vocal_health_score DECIMAL(5,2),
    
    -- Flags
    detected_anomalies JSONB,
    requires_clinical_review BOOLEAN DEFAULT FALSE,
    
    -- Duration
    recording_duration_seconds INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_biometrics_user ON voice_biometrics(user_id);
CREATE INDEX idx_voice_biometrics_review ON voice_biometrics(requires_clinical_review);

-- ============================================
-- MEDICATION SCHEDULES
-- ============================================
CREATE TABLE medication_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Medication Details
    medication_name VARCHAR(255) NOT NULL,
    medication_type VARCHAR(50), -- 'pill', 'liquid', 'injection', etc.
    dosage VARCHAR(100),
    dosage_unit VARCHAR(50),
    frequency VARCHAR(100), -- 'daily', 'twice_daily', 'as_needed', etc.
    instructions TEXT,
    
    -- Schedule
    times_of_day TIME[],
    days_of_week INTEGER[],
    
    -- Prescription Info
    prescriber_name VARCHAR(255),
    prescription_date DATE,
    refills_remaining INTEGER,
    
    -- Tracking
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- MEDICATION LOGS
-- ============================================
CREATE TABLE medication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES medication_schedules(id) ON DELETE CASCADE,
    
    -- Log Details
    scheduled_time TIMESTAMP NOT NULL,
    actual_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- 'taken', 'missed', 'skipped', 'pending'
    notes TEXT,
    
    -- Correlation with mood
    mood_correlation_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_medication_logs_medication ON medication_logs(medication_id);
CREATE INDEX idx_medication_logs_status ON medication_logs(status);

-- ============================================
-- BEHAVIORAL DATA (HealthKit/Google Fit Sync)
-- ============================================
CREATE TABLE behavioral_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sleep Data
    sleep_duration_hours DECIMAL(5,2),
    sleep_quality_score DECIMAL(5,2),
    deep_sleep_hours DECIMAL(5,2),
    rem_sleep_hours DECIMAL(5,2),
    sleep_heart_rate_avg INTEGER,
    
    -- Activity Data
    steps_count INTEGER,
    active_minutes INTEGER,
    calories_burned INTEGER,
    distance_km DECIMAL(8,2),
    
    -- Heart Rate Variability
    hrv_ms DECIMAL(8,2),
    resting_heart_rate INTEGER,
    heart_rate_variability_data JSONB,
    
    -- Data Source
    source VARCHAR(50), -- 'healthkit', 'google_fit', 'manual'
    
    data_date DATE NOT NULL,
    data_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_behavioral_data_user ON behavioral_data(user_id);
CREATE INDEX idx_behavioral_data_date ON behavioral_data(data_date);

-- ============================================
-- PREDICTIVE ANALYTICS
-- ============================================
CREATE TABLE predictive_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Predictions
    burnout_risk_score DECIMAL(5,2),
    anxiety_trend_prediction JSONB,
    mood_trend_prediction JSONB,
    
    -- Alerts
    proactive_wellness_insight JSONB,
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_trigger_reason TEXT,
    
    -- Confidence
    model_version VARCHAR(50),
    prediction_confidence DECIMAL(5,4),
    
    analysis_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictive_insights_user ON predictive_insights(user_id);
CREATE INDEX idx_predictive_insights_alerts ON predictive_insights(alert_triggered);

-- ============================================
-- AUTHENTICATION & SECURITY
-- ============================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    user_agent VARCHAR(500),
    ip_address VARCHAR(50)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================
-- AUDIT LOG (HIPAA Compliance)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Update timestamp on table updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_medication_schedules_timestamp
    BEFORE UPDATE ON medication_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_journal_entries_timestamp
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Mental Health Index Calculation Function
CREATE OR REPLACE FUNCTION calculate_mental_health_index(
    phq9 INTEGER,
    gad7 INTEGER,
    mood INTEGER,
    sleep INTEGER,
    anxiety INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    mhi DECIMAL(5,2);
BEGIN
    -- MHI = 100 - (PHQ-9 * 2 + GAD-7 * 2 + (10-mood) * 3 + (10-sleep) * 1.5 + anxiety * 1.5)
    mhi := 100.00 - (
        phq9 * 2.0 + 
        gad7 * 2.0 + 
        (10 - mood) * 3.0 + 
        (10 - sleep) * 1.5 + 
        anxiety * 1.5
    );
    
    -- Clamp between 0 and 100
    RETURN GREATEST(0.00, LEAST(100.00, mhi));
END;
$$ LANGUAGE plpgsql;

-- Proactive Wellness Insight Trigger
CREATE OR REPLACE FUNCTION check_wellness_alert()
RETURNS TRIGGER AS $$
DECLARE
    trend_decline DECIMAL(5,2);
    previous_mhi DECIMAL(5,2);
BEGIN
    -- Get previous MHI from 3 days ago
    SELECT mental_health_index INTO previous_mhi
    FROM mood_logs
    WHERE user_id = NEW.user_id
    AND log_date = NEW.log_date - INTERVAL '3 days'
    ORDER BY log_date DESC
    LIMIT 1;

    IF previous_mhi IS NOT NULL THEN
        -- Check for 20% decline
        trend_decline := ((previous_mhi - NEW.mental_health_index) / previous_mhi) * 100;
        
        IF trend_decline >= 20 THEN
            INSERT INTO predictive_insights (
                user_id,
                burnout_risk_score,
                alert_triggered,
                alert_trigger_reason,
                analysis_date
            ) VALUES (
                NEW.user_id,
                NEW.mental_health_index / 10.0,
                TRUE,
                CONCAT('20% decline detected over 3 days (from ', previous_mhi::TEXT, ' to ', NEW.mental_health_index::TEXT, ')'),
                NEW.log_date
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wellness_alert
    AFTER INSERT ON mood_logs
    FOR EACH ROW
    WHEN (NEW.mental_health_index IS NOT NULL)
    EXECUTE FUNCTION check_wellness_alert();

