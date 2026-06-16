-- ============================================
-- 001_init_schema.sql
-- Shelter Monitoring System - Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- TABLES
-- ============================================

-- Users (integrates with Supabase Auth)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_user_id UUID REFERENCES auth.users(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'technician')) DEFAULT 'technician',
    telegram_chat_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shelters
CREATE TABLE shelters (
    shelter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
    device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    device_type VARCHAR(20) CHECK (device_type IN ('temperature', 'vibration', 'camera')),
    device_name VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    last_seen TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thresholds (per shelter)
CREATE TABLE thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID UNIQUE REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    temp_warning FLOAT DEFAULT 35.0,
    temp_critical FLOAT DEFAULT 40.0,
    vibration_limit FLOAT DEFAULT 2.0,
    humidity_warning FLOAT DEFAULT 80.0,
    humidity_critical FLOAT DEFAULT 90.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temperature Data (time-series)
CREATE TABLE temperature_data (
    data_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(device_id) ON DELETE CASCADE,
    temperature FLOAT NOT NULL,
    humidity FLOAT,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vibration Data (time-series)
CREATE TABLE vibration_data (
    data_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(device_id) ON DELETE CASCADE,
    accel_x FLOAT NOT NULL,
    accel_y FLOAT NOT NULL,
    accel_z FLOAT NOT NULL,
    gyro_x FLOAT NOT NULL,
    gyro_y FLOAT NOT NULL,
    gyro_z FLOAT NOT NULL,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    temp_data_id UUID REFERENCES temperature_data(data_id) ON DELETE SET NULL,
    vibration_data_id UUID REFERENCES vibration_data(data_id) ON DELETE SET NULL,
    alert_type VARCHAR(20) CHECK (alert_type IN ('temp', 'vibration', 'intrusion', 'offline')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'closed')),
    severity VARCHAR(20) CHECK (severity IN ('warning', 'critical')),
    message TEXT,
    assigned_to UUID REFERENCES users(user_id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- CCTV Evidence (metadata only - images in Supabase Storage)
CREATE TABLE cctv_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(alert_id) ON DELETE CASCADE,
    storage_path VARCHAR(255) NOT NULL,
    public_url VARCHAR(500),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    faces_detected INTEGER DEFAULT 0,
    face_metadata JSONB DEFAULT '[]',
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_alerts_status ON alerts(status, created_at DESC);
CREATE INDEX idx_alerts_shelter ON alerts(shelter_id, created_at DESC);
CREATE INDEX idx_devices_shelter ON devices(shelter_id);
CREATE INDEX idx_evidence_alert ON cctv_evidence(alert_id);
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_temperature_shelter_time ON temperature_data(shelter_id, timestamp DESC);
CREATE INDEX idx_temperature_device ON temperature_data(device_id);
CREATE INDEX idx_vibration_shelter_time ON vibration_data(shelter_id, timestamp DESC);
CREATE INDEX idx_vibration_device ON vibration_data(device_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_shelters_updated_at BEFORE UPDATE ON shelters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_thresholds_updated_at BEFORE UPDATE ON thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
