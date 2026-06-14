-- Create company-assets storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload company assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to update
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update company assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow public read
DO $$ BEGIN
  CREATE POLICY "Public can read company assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
