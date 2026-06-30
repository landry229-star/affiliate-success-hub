
DROP POLICY "Anyone can insert clicks" ON public.clicks;
CREATE POLICY "Anyone can insert clicks for existing products" ON public.clicks
  FOR INSERT
  WITH CHECK (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = product_id));
