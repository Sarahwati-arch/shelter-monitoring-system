-- ============================================
-- 003_storage_buckets.sql
-- Supabase Storage Setup for CCTV Evidence
-- ============================================

-- Create storage bucket for CCTV evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cctv-evidence',
    'cctv-evidence',
    false,
    10485760,  -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Authenticated users can view evidence
CREATE POLICY "Authenticated users can view evidence"
    ON storage.objects FOR SELECT
    TO authenticated USING (bucket_id = 'cctv-evidence');

-- Service role can upload evidence
CREATE POLICY "Service role can upload evidence"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');

-- Service role can delete evidence
CREATE POLICY "Service role can delete evidence"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');
