-- Create storage bucket for order exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-exports',
  'order-exports',
  true,
  5242880,
  ARRAY['text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their order CSVs
CREATE POLICY "Users can upload order exports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-exports' AND
  auth.uid() IS NOT NULL
);

-- Allow public access to download order exports
CREATE POLICY "Public can download order exports"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'order-exports');

-- Allow users to delete their own order exports (cleanup)
CREATE POLICY "Users can delete their order exports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-exports' AND
  auth.uid() IS NOT NULL
);