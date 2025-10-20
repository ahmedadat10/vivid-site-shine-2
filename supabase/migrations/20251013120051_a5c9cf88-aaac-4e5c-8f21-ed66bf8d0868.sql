-- Add order_number column to orders table
ALTER TABLE public.orders ADD COLUMN order_number TEXT UNIQUE;

-- Create function to generate order number from username
CREATE OR REPLACE FUNCTION public.generate_order_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_username_prefix TEXT;
  v_order_count INTEGER;
  v_order_number TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Extract first 3 letters from email (before @)
  v_username_prefix := LOWER(SUBSTRING(SPLIT_PART(v_email, '@', 1), 1, 3));
  
  -- Count existing orders for this user to get next number
  SELECT COUNT(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = p_user_id;
  
  -- Generate order number with format: abc-0001
  v_order_number := v_username_prefix || '-' || LPAD((v_order_count + 1)::TEXT, 4, '0');
  
  RETURN v_order_number;
END;
$$;

-- Create trigger to auto-generate order number on insert
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.order_number := generate_order_number(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();