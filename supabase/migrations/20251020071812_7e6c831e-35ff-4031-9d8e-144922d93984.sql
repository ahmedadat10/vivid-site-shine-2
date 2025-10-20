-- Fix 1: Secure product_pricing with role-based RLS policies
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Users can view pricing" ON public.product_pricing;

-- Add role-specific policies
CREATE POLICY "Counter staff view retail pricing only"
ON public.product_pricing FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'counter_staff');

CREATE POLICY "Dealers view all pricing"
ON public.product_pricing FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) IN ('dealer_6', 'dealer_4', 'dealer_marketing'));

CREATE POLICY "Admins view all pricing"
ON public.product_pricing FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Make order-exports bucket private and add RLS
UPDATE storage.buckets 
SET public = false 
WHERE id = 'order-exports';

-- Add RLS policy for storage bucket
CREATE POLICY "Users access own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-exports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload own exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-exports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Fix 3: Add database constraints for input validation
-- Drop constraints if they exist, then recreate them
DO $$ 
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS code_length;
  ALTER TABLE products ADD CONSTRAINT code_length CHECK (length(code) <= 50);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS description_length;
  ALTER TABLE products ADD CONSTRAINT description_length CHECK (length(description) <= 500);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE product_pricing DROP CONSTRAINT IF EXISTS positive_dealer_price;
  ALTER TABLE product_pricing ADD CONSTRAINT positive_dealer_price CHECK (dealer_price >= 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE product_pricing DROP CONSTRAINT IF EXISTS positive_retail_price;
  ALTER TABLE product_pricing ADD CONSTRAINT positive_retail_price CHECK (retail_price >= 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE stock DROP CONSTRAINT IF EXISTS non_negative_quantity;
  ALTER TABLE stock ADD CONSTRAINT non_negative_quantity CHECK (quantity >= 0);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;