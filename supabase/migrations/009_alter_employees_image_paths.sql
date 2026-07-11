-- Migration: Modify Employees Table for Multiple Photos
-- Description: Changes image_path (TEXT) to image_paths (TEXT[])

-- Add the new column
ALTER TABLE public.employees ADD COLUMN image_paths TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing data (if any)
UPDATE public.employees SET image_paths = ARRAY[image_path] WHERE image_path IS NOT NULL;

-- Drop the old column
ALTER TABLE public.employees DROP COLUMN image_path;
