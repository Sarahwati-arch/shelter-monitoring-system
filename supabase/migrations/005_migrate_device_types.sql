-- ============================================================================
-- 005_migrate_device_types.sql
-- Safe migration: update device_type constraint without dropping data
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop old constraint FIRST so UPDATE can use new values
ALTER TABLE devices
    DROP CONSTRAINT IF EXISTS devices_device_type_check;

-- Step 2: Update existing 'sensor' device_type values to the correct type
--         based on device_name pattern (*-TEMP-* → temperature, *-VIB-* → vibration)
UPDATE devices
SET device_type = 'temperature'
WHERE device_type = 'sensor' AND device_name LIKE '%-TEMP-%';

UPDATE devices
SET device_type = 'vibration'
WHERE device_type = 'sensor' AND device_name LIKE '%-VIB-%';

-- Step 3: Add new constraint with updated values
ALTER TABLE devices
    ADD CONSTRAINT devices_device_type_check
    CHECK (device_type IN ('temperature', 'vibration', 'camera'));

-- Step 3: Add new indexes (safe to run, IF NOT EXISTS not supported for CREATE INDEX,
--         so we use DO block to skip if already exists)
DO $$
BEGIN
    -- devices type index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_type'
    ) THEN
        CREATE INDEX idx_devices_type ON devices(device_type);
    END IF;

    -- temperature_data indexes
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_temperature_shelter_time'
    ) THEN
        CREATE INDEX idx_temperature_shelter_time ON temperature_data(shelter_id, timestamp DESC);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_temperature_device'
    ) THEN
        CREATE INDEX idx_temperature_device ON temperature_data(device_id);
    END IF;

    -- vibration_data indexes
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vibration_shelter_time'
    ) THEN
        CREATE INDEX idx_vibration_shelter_time ON vibration_data(shelter_id, timestamp DESC);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vibration_device'
    ) THEN
        CREATE INDEX idx_vibration_device ON vibration_data(device_id);
    END IF;
END
$$;

-- ============================================================================
-- Done! Verify:
--   SELECT device_type, count(*) FROM devices GROUP BY device_type;
--   Expected: temperature, vibration, camera (no 'sensor')
-- ============================================================================
