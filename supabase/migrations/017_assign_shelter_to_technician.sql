-- ============================================
-- 017_assign_shelter_to_technician.sql
-- Add assigned_shelter_id to users and update RLS
-- ============================================

-- 1. Add column to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS assigned_shelter_id UUID REFERENCES shelters(shelter_id) ON DELETE SET NULL;

-- 2. Update auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (supabase_user_id, name, email, role, assigned_shelter_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'technician'),
        NULLIF(NEW.raw_user_meta_data->>'assigned_shelter_id', '')::uuid
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RLS Policies
-- First, drop the permissive/old policies
DROP POLICY IF EXISTS "Authenticated users can view shelters" ON shelters;
DROP POLICY IF EXISTS "Authenticated users can view devices" ON devices;
DROP POLICY IF EXISTS "Authenticated users can view temperature data" ON temperature_data;
DROP POLICY IF EXISTS "Authenticated users can view vibration data" ON vibration_data;
DROP POLICY IF EXISTS "Authenticated users can view alerts" ON alerts;
DROP POLICY IF EXISTS "Authenticated users can view thresholds" ON thresholds;
DROP POLICY IF EXISTS "Authenticated users can view evidence" ON cctv_evidence;

-- Shelters
CREATE POLICY "Users can view shelters based on role" ON shelters
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = shelters.shelter_id)
    );

-- Devices
CREATE POLICY "Users can view devices based on shelter" ON devices
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = devices.shelter_id)
    );

-- Temperature Data
CREATE POLICY "Users can view temperature data based on shelter" ON temperature_data
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = temperature_data.shelter_id)
    );

-- Vibration Data
CREATE POLICY "Users can view vibration data based on shelter" ON vibration_data
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = vibration_data.shelter_id)
    );

-- Alerts
CREATE POLICY "Users can view alerts based on shelter" ON alerts
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = alerts.shelter_id)
    );

-- Thresholds
CREATE POLICY "Users can view thresholds based on shelter" ON thresholds
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'technician' AND assigned_shelter_id = thresholds.shelter_id)
    );

-- CCTV Evidence
CREATE POLICY "Users can view evidence based on shelter" ON cctv_evidence
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
        OR
        EXISTS (
            SELECT 1 FROM alerts a
            WHERE a.alert_id = cctv_evidence.alert_id
            AND EXISTS (
                SELECT 1 FROM users u 
                WHERE u.supabase_user_id = auth.uid() 
                AND u.role = 'technician' 
                AND u.assigned_shelter_id = a.shelter_id
            )
        )
    );
