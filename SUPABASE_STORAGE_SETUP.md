# Supabase Storage Setup Guide

## Issue: Upload Failed

The file upload is failing because the Supabase Storage bucket doesn't exist or isn't configured properly.

## Fix: Create Storage Bucket

### Step 1: Go to Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your project
3. Click on **Storage** in the left sidebar

### Step 2: Create Bucket
1. Click **"New bucket"** button
2. **Name**: `group-files`
3. **Public bucket**: Toggle **ON** (important!)
4. Click **"Create bucket"**

### Step 3: Set Bucket Policies (Optional but Recommended)
1. Click on the `group-files` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**
4. Choose **"For full customization"**
5. Add these policies:

#### Policy 1: Allow Public Read
```sql
-- Name: Public read access
-- Operation: SELECT

CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-files');
```

#### Policy 2: Allow Authenticated Upload
```sql
-- Name: Authenticated users can upload
-- Operation: INSERT

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-files');
```

#### Policy 3: Allow Users to Delete Their Own Files
```sql
-- Name: Users can delete own files
-- Operation: DELETE

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-files' AND auth.uid() = owner);
```

### Step 4: Verify Setup
1. Go back to **Storage** → **group-files**
2. Try uploading a test file manually
3. If successful, the bucket is configured correctly

## Alternative: Use SQL Script

You can also run this SQL in the Supabase SQL Editor:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-files', 'group-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up policies
CREATE POLICY IF NOT EXISTS "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-files');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-files');

CREATE POLICY IF NOT EXISTS "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-files' AND auth.uid() = owner);
```

## Testing After Setup

1. Restart your dev server: `npm run dev`
2. Go to `localhost:3000/my-notes`
3. Click **"New Document"**
4. Upload a file
5. Should work now! ✅

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `group-files`
- Check that the bucket exists in Supabase Dashboard

### Error: "Permission denied"
- Make sure the bucket is set to **public**
- Check that the policies are set up correctly

### Error: "File too large"
- Files must be under 10MB
- Check the file size before uploading

### Still Not Working?
1. Check browser console for detailed error messages
2. Check Supabase logs in the Dashboard
3. Verify environment variables are set correctly:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Quick Check

Run this in your browser console on the my-notes page:

```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has Supabase Key:', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
```

Both should show values. If not, check your `.env` file.
