-- Add INSERT policy for order_items
CREATE POLICY "Users can insert order items for their orders"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Add UPDATE policy for order_items (for future use)
CREATE POLICY "Users can update order items for their orders"
ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Add DELETE policy for order_items (for future use)
CREATE POLICY "Users can delete order items for their orders"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);