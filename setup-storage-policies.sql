-- Setup Storage policies for group-files bucket
-- Run this in Supabase SQL Editor

-- Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'group-files' );

-- Allow anyone to upload files (for testing - restrict in production!)
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'group-files' );

-- Allow anyone to update files (for testing)
CREATE POLICY "Allow updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'group-files' );

-- Allow anyone to delete files (for testing)
CREATE POLICY "Allow deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'group-files' );
