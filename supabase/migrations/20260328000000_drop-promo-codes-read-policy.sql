-- Security fix: drop overly permissive read policy on promo_codes
-- The old policy let any authenticated user SELECT all active codes,
-- leaking promo code strings. The redemption API uses the admin client
-- (service role) which bypasses RLS, so no read policy is needed.

DROP POLICY IF EXISTS "Anyone can read active promo codes" ON promo_codes;
