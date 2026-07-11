-- Migration: Create Employees Table & Storage Bucket
-- Description: Sets up the database and storage for the Cloud-to-Edge Facial Enrollment System.

-- 1. Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    image_path TEXT NOT NULL,
    is_synced BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for the table
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (Admins) to manage employees
CREATE POLICY "Allow authenticated users full access to employees"
ON public.employees
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role (Edge Node) full access to employees
CREATE POLICY "Allow service role full access to employees"
ON public.employees
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Create Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-faces', 'employee-faces', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Enable RLS on objects (if not already enabled globally)
-- Objects table handles the actual files in buckets.
-- We use standard policies for the 'employee-faces' bucket.

-- Allow authenticated admins to upload/read images
CREATE POLICY "Admins can upload to employee-faces"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-faces');

CREATE POLICY "Admins can view employee-faces"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'employee-faces');

-- Allow service_role (Edge device) to read objects
CREATE POLICY "Service role can view employee-faces"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'employee-faces');

-- Allow service_role to delete objects (after sync)
CREATE POLICY "Service role can delete employee-faces"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'employee-faces');
