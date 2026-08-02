-- ============================================
-- 013_system_settings.sql
-- Create system settings table and update cron jobs
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert defaults
INSERT INTO system_settings (key, value, description) VALUES
    ('retention_sensor_data_days', '90'::jsonb, 'Number of days to keep sensor data (temperature, vibration)'),
    ('retention_alerts_days', '365'::jsonb, 'Number of days to keep closed alerts'),
    ('retention_evidence_days', '180'::jsonb, 'Number of days to keep CCTV evidence data'),
    ('telegram_bot_active', 'false'::jsonb, 'Toggle to indicate if Telegram bot is actively configured')
ON CONFLICT (key) DO NOTHING;

-- Set up RLS (Will fail safely if already enabled)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
DROP POLICY IF EXISTS "Allow authenticated read access" ON system_settings;
CREATE POLICY "Allow authenticated read access"
    ON system_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow update access only to admins
DROP POLICY IF EXISTS "Allow admin update access" ON system_settings;
CREATE POLICY "Allow admin update access"
    ON system_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.supabase_user_id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Allow insert access only to admins (if they need to add new settings later)
DROP POLICY IF EXISTS "Allow admin insert access" ON system_settings;
CREATE POLICY "Allow admin insert access"
    ON system_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.supabase_user_id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update pg_cron jobs to use dynamic values from system_settings
-- (cron.schedule will overwrite existing jobs with the same name)


-- Reschedule them with dynamic queries
SELECT cron.schedule(
    'cleanup-temperature-data',
    '0 2 * * *',
    $$DELETE FROM temperature_data WHERE timestamp < NOW() - ((SELECT (value#>>'{}')::int FROM system_settings WHERE key = 'retention_sensor_data_days') || ' days')::interval$$
);

SELECT cron.schedule(
    'cleanup-vibration-data',
    '0 2 * * *',
    $$DELETE FROM vibration_data WHERE timestamp < NOW() - ((SELECT (value#>>'{}')::int FROM system_settings WHERE key = 'retention_sensor_data_days') || ' days')::interval$$
);

SELECT cron.schedule(
    'cleanup-old-alerts',
    '0 3 * * *',
    $$DELETE FROM alerts WHERE status = 'closed' AND resolved_at < NOW() - ((SELECT (value#>>'{}')::int FROM system_settings WHERE key = 'retention_alerts_days') || ' days')::interval$$
);

SELECT cron.schedule(
    'cleanup-old-evidence',
    '0 4 * * *',
    $$DELETE FROM cctv_evidence WHERE created_at < NOW() - ((SELECT (value#>>'{}')::int FROM system_settings WHERE key = 'retention_evidence_days') || ' days')::interval$$
);
