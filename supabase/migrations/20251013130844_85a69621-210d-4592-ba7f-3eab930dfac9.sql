-- Remove status column from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS status;