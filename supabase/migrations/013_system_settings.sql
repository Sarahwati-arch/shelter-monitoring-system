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


