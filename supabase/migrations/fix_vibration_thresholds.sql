-- ============================================================================
-- Migration: Fix vibration thresholds schema
-- Replaces single 'vibration_limit' with 'vibration_warning' and 'vibration_critical'
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE thresholds
  ADD COLUMN IF NOT EXISTS vibration_warning FLOAT DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS vibration_critical FLOAT DEFAULT 0.7;

-- Backfill data (Optional: inherit old limit to critical if it existed)
UPDATE thresholds
  SET vibration_warning = 0.3,
      vibration_critical = 0.7
  WHERE vibration_warning IS NULL OR vibration_critical IS NULL;

-- Drop the old column
ALTER TABLE thresholds DROP COLUMN IF EXISTS vibration_limit;
