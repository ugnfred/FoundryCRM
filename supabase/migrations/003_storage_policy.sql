-- Create company-assets storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to update
CREATE POLICY IF NOT EXISTS "Authenticated users can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets');

-- Allow public read
CREATE POLICY IF NOT EXISTS "Public can read company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');
