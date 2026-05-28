-- ============================================================================
-- Shelter Monitoring System - Cloud Setup Script (Idempotent)
-- Supabase SQL Editor: Paste this entire file and click Run
-- Safe to re-run: drops existing objects before recreating
-- ============================================================================
-- Contents:
--   1. Drop existing objects (reverse order)
--   2. Extensions
--   3. Tables (users, shelters, devices, thresholds, temperature_data,
--              vibration_data, alerts, cctv_evidence, audit_logs)
--   4. Indexes
--   5. Trigger function & triggers
--   6. Row Level Security (enable + policies)
--   7. Storage bucket & policies
--   8. Seed data
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING OBJECTS (reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS cctv_evidence CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS vibration_data CASCADE;
DROP TABLE IF EXISTS temperature_data CASCADE;
DROP TABLE IF EXISTS sensor_data CASCADE; -- legacy, may not exist
DROP TABLE IF EXISTS thresholds CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS shelters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================================================
-- 2. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 3. TABLES
-- ============================================================================

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

-- Thresholds (per shelter, 1:1)
CREATE TABLE thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelter_id UUID UNIQUE REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    temp_warning FLOAT DEFAULT 35.0,
    temp_critical FLOAT DEFAULT 40.0,
    vibration_limit FLOAT DEFAULT 2.0,
    humidity_warning FLOAT DEFAULT 80.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temperature Data (time-series, from DHT22 / temperature sensors)
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

-- Vibration Data (time-series, from MPU6050 / vibration sensors)
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
    temp_data_id UUID REFERENCES temperature_data(data_id),
    vibration_data_id UUID REFERENCES vibration_data(data_id),
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

-- CCTV Evidence (metadata only - images stored in Supabase Storage)
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

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX idx_temp_shelter_time ON temperature_data(shelter_id, timestamp DESC);
CREATE INDEX idx_vib_shelter_time ON vibration_data(shelter_id, timestamp DESC);
CREATE INDEX idx_alerts_status ON alerts(status, created_at DESC);
CREATE INDEX idx_alerts_shelter ON alerts(shelter_id, created_at DESC);
CREATE INDEX idx_devices_shelter ON devices(shelter_id);
CREATE INDEX idx_evidence_alert ON cctv_evidence(alert_id);
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp DESC);

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

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

-- Auto-insert user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (supabase_user_id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'technician')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ---- Users ----

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (supabase_user_id = auth.uid());

CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ---- Shelters ----

CREATE POLICY "Authenticated users can view shelters" ON shelters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage shelters" ON shelters
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ---- Devices ----

CREATE POLICY "Authenticated users can view devices" ON devices
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage devices" ON devices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ---- Temperature Data ----

CREATE POLICY "Service role can insert temperature data" ON temperature_data
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view temperature data" ON temperature_data
    FOR SELECT TO authenticated USING (true);

-- ---- Vibration Data ----

CREATE POLICY "Service role can insert vibration data" ON vibration_data
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view vibration data" ON vibration_data
    FOR SELECT TO authenticated USING (true);

-- ---- Alerts ----

CREATE POLICY "Service role can insert alerts" ON alerts
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view alerts" ON alerts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Technicians can update assigned alerts" ON alerts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND user_id = alerts.assigned_to)
        OR EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ---- Thresholds ----

CREATE POLICY "Authenticated users can view thresholds" ON thresholds
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage thresholds" ON thresholds
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ---- CCTV Evidence ----

CREATE POLICY "Authenticated users can view evidence" ON cctv_evidence
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert evidence" ON cctv_evidence
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ---- Audit Logs ----

CREATE POLICY "Service can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================================================
-- 7. STORAGE BUCKET & POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cctv-evidence',
    'cctv-evidence',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Authenticated users can view evidence"
    ON storage.objects FOR SELECT
    TO authenticated USING (bucket_id = 'cctv-evidence');

CREATE POLICY "Service role can upload evidence"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');

CREATE POLICY "Service role can delete evidence"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');

-- ============================================================================
-- 8. SEED DATA
-- ============================================================================

-- Sample users (supabase_user_id set to NULL until linked via auth signup)
INSERT INTO users (user_id, supabase_user_id, name, email, role) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, 'Admin User', 'admin@shelter.local', 'admin'),
    ('00000000-0000-0000-0000-000000000002', NULL, 'Tech Sarah', 'sarah@shelter.local', 'technician'),
    ('00000000-0000-0000-0000-000000000003', NULL, 'Tech Budi', 'budi@shelter.local', 'technician')
ON CONFLICT (user_id) DO NOTHING;

-- Sample shelters
INSERT INTO shelters (shelter_id, shelter_name, location, description, latitude, longitude) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Shelter Jakarta Timur', 'Jakarta Timur', 'Main monitoring shelter near industrial zone', -6.30200000, 107.17100000),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Shelter Jakarta Pusat', 'Jakarta Pusat', 'Secondary shelter in agricultural area', -6.32300000, 107.33700000),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Shelter Jakarta Selatan', 'Jakarta Selatan', 'Warehouse district monitoring point', -6.28500000, 107.15800000)
ON CONFLICT (shelter_id) DO NOTHING;

-- Sample thresholds
INSERT INTO thresholds (shelter_id, temp_warning, temp_critical, vibration_limit, humidity_warning) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 35.0, 40.0, 2.0, 80.0),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 33.0, 38.0, 1.8, 85.0),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 36.0, 42.0, 2.5, 75.0)
ON CONFLICT (shelter_id) DO NOTHING;

-- Sample devices (2 temperature + 1 vibration + 2 cameras)
INSERT INTO devices (device_id, shelter_id, device_type, device_name, token, status) VALUES
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'temperature', 'ESP32-TEMP-Alpha', 'tok_esp32_temp_alpha_001', 'active'),
    ('e5f6a7b8-c9d0-1234-efab-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vibration', 'ESP32-VIB-Alpha', 'tok_esp32_vib_alpha_001', 'active'),
    ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'camera', 'RPi-CAM-Alpha', 'tok_rpi_cam_alpha_001', 'active'),
    ('a7b8c9d0-e1f2-3456-abcd-567890123456', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'temperature', 'ESP32-TEMP-Beta', 'tok_esp32_temp_beta_001', 'active'),
    ('b8c9d0e1-f2a3-4567-bcde-678901234567', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'camera', 'RPi-CAM-Beta', 'tok_rpi_cam_beta_001', 'inactive')
ON CONFLICT (device_id) DO NOTHING;

-- Sample temperature data (from DHT22 / temperature sensors)
INSERT INTO temperature_data (shelter_id, device_id, temperature, humidity, risk_level, timestamp) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 32.5, 65.0, 'low', NOW() - INTERVAL '5 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 33.1, 63.2, 'low', NOW() - INTERVAL '10 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 34.8, 61.5, 'medium', NOW() - INTERVAL '15 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 36.2, 58.0, 'medium', NOW() - INTERVAL '20 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 38.7, 55.3, 'high', NOW() - INTERVAL '25 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 35.4, 60.1, 'medium', NOW() - INTERVAL '30 minutes'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a7b8c9d0-e1f2-3456-abcd-567890123456', 30.2, 72.0, 'low', NOW() - INTERVAL '5 minutes'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a7b8c9d0-e1f2-3456-abcd-567890123456', 29.8, 73.5, 'low', NOW() - INTERVAL '10 minutes'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', NULL, 31.0, 68.0, 'low', NOW() - INTERVAL '5 minutes');

-- Sample vibration data (from MPU6050 / vibration sensors)
INSERT INTO vibration_data (shelter_id, device_id, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, risk_level, timestamp) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 0.05, -0.99, -0.08, -2.62, 9.12, -0.90, 'low', NOW() - INTERVAL '5 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 0.12, -0.87, -0.15, -2.80, 9.45, -1.02, 'low', NOW() - INTERVAL '10 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 0.45, -1.23, -0.34, -3.15, 10.50, -1.45, 'medium', NOW() - INTERVAL '15 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 1.15, -1.56, -0.78, -4.20, 12.30, -2.10, 'high', NOW() - INTERVAL '25 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 0.32, -1.05, -0.22, -3.00, 9.80, -1.20, 'medium', NOW() - INTERVAL '30 minutes');

-- Sample alerts (5 alerts with various states)
INSERT INTO alerts (shelter_id, alert_type, status, severity, message, created_at) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'temp', 'open', 'critical', 'Temperature exceeded critical threshold: 38.7°C (limit: 40.0°C)', NOW() - INTERVAL '25 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vibration', 'acknowledged', 'warning', 'Vibration level elevated: accel magnitude 1.82 g (limit: 2.0 g)', NOW() - INTERVAL '1 hour'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'offline', 'open', 'warning', 'Device RPi-CAM-Beta has been offline for 30+ minutes', NOW() - INTERVAL '30 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'intrusion', 'closed', 'critical', 'Unknown person detected at Shelter Alpha entrance', NOW() - INTERVAL '2 hours'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'temp', 'closed', 'warning', 'Temperature approaching warning threshold: 34.5°C', NOW() - INTERVAL '3 hours');

-- ============================================================================
-- DONE!
-- ============================================================================
-- Verify in Supabase Dashboard:
--   - Table Editor: 9 tables with seed data
--   - Storage: bucket "cctv-evidence" exists
--   - Authentication > Policies: RLS policies active
--   - Database > Extensions: uuid-ossp enabled
-- ============================================================================
