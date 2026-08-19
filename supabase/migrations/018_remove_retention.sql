-- ============================================
-- 018_remove_retention.sql
-- Remove data retention settings and pg_cron jobs
-- ============================================

-- Remove the retention settings from system_settings table
DELETE FROM system_settings 
WHERE key IN (
    'retention_sensor_data_days', 
    'retention_alerts_days', 
    'retention_evidence_days'
);

-- Unschedule the pg_cron jobs if they exist
SELECT cron.unschedule('cleanup-temperature-data');
SELECT cron.unschedule('cleanup-vibration-data');
SELECT cron.unschedule('cleanup-old-alerts');
SELECT cron.unschedule('cleanup-old-evidence');
