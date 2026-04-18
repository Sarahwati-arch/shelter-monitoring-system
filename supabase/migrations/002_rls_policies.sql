-- ============================================
-- 002_rls_policies.sql
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (supabase_user_id = auth.uid());

CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- SHELTERS POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view shelters" ON shelters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage shelters" ON shelters
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- DEVICES POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view devices" ON devices
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage devices" ON devices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- SENSOR DATA POLICIES
-- ============================================

CREATE POLICY "Service role can insert sensor data" ON sensor_data
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view sensor data" ON sensor_data
    FOR SELECT TO authenticated USING (true);

-- ============================================
-- ALERTS POLICIES
-- ============================================

CREATE POLICY "Service role can insert alerts" ON alerts
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view alerts" ON alerts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Technicians can update assigned alerts" ON alerts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND user_id = alerts.assigned_to)
        OR EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- THRESHOLDS POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view thresholds" ON thresholds
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage thresholds" ON thresholds
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- CCTV EVIDENCE POLICIES
-- ============================================

CREATE POLICY "Authenticated users can view evidence" ON cctv_evidence
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert evidence" ON cctv_evidence
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

CREATE POLICY "Service can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
    );
