-- Migration to split vibration_limit into warning and critical thresholds

-- 1. Rename existing column to warning
ALTER TABLE thresholds RENAME COLUMN vibration_limit TO vibration_warning;

-- 2. Add new critical threshold column
ALTER TABLE thresholds ADD COLUMN vibration_critical FLOAT DEFAULT 20.0;

-- 3. Update default value for warning
ALTER TABLE thresholds ALTER COLUMN vibration_warning SET DEFAULT 10.0;
