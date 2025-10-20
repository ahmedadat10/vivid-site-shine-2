-- Add admin role to the enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';