-- ============================================
-- 014_enable_realtime.sql
-- Enable Supabase Realtime for live data tables
-- ============================================
-- Run this in Supabase Dashboard > SQL Editor
-- After running, verify in Table Editor > [table] > Realtime tab
-- ============================================

-- Enable REPLICA IDENTITY FULL so realtime events carry full row data
-- (both OLD and NEW values), required for UPDATE/DELETE events
ALTER TABLE temperature_data REPLICA IDENTITY FULL;
ALTER TABLE vibration_data   REPLICA IDENTITY FULL;
ALTER TABLE alerts           REPLICA IDENTITY FULL;
ALTER TABLE cctv_evidence    REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
-- This is what makes the Replication page show these tables
ALTER PUBLICATION supabase_realtime ADD TABLE temperature_data;
ALTER PUBLICATION supabase_realtime ADD TABLE vibration_data;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE cctv_evidence;
