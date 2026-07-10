-- ============================================================================
-- Migration: Add sensor interval columns to thresholds table
-- Run this in Supabase SQL Editor if you already have an existing DB.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================================

-- Add temperature interval column (default 5 seconds)
ALTER TABLE thresholds
  ADD COLUMN IF NOT EXISTS temp_interval_ms INTEGER DEFAULT 5000
    CHECK (temp_interval_ms >= 1000 AND temp_interval_ms <= 60000);

-- Add vibration interval column (default 1 second)
ALTER TABLE thresholds
  ADD COLUMN IF NOT EXISTS vibration_interval_ms INTEGER DEFAULT 1000
    CHECK (vibration_interval_ms >= 1000 AND vibration_interval_ms <= 60000);

-- Backfill existing rows with defaults (in case constraints block NULL)
UPDATE thresholds
  SET temp_interval_ms = 5000
  WHERE temp_interval_ms IS NULL;

UPDATE thresholds
  SET vibration_interval_ms = 1000
  WHERE vibration_interval_ms IS NULL;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT shelter_id, temp_interval_ms, vibration_interval_ms FROM thresholds;
