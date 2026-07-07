INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cctv-evidence',
    'cctv-evidence',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Authenticated users can view evidence"
    ON storage.objects FOR SELECT
    TO authenticated USING (bucket_id = 'cctv-evidence');

CREATE POLICY "Service role can upload evidence"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');

CREATE POLICY "Service role can delete evidence"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'cctv-evidence' AND auth.role() = 'service_role');
