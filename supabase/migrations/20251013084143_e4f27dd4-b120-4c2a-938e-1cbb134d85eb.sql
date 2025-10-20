-- Fix security issue: Add RLS policies for user_roles table
CREATE POLICY "Users can view their own role" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own role" ON public.user_roles 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- Fix security issue: Set search_path for function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
