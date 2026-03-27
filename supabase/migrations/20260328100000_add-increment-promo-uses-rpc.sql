-- Atomic promo code increment: prevents race condition where concurrent
-- redemptions all read the same current_uses and write old+1, undercounting.
-- Returns true if increment succeeded (within cap), false otherwise.

CREATE OR REPLACE FUNCTION increment_promo_uses(p_id uuid, p_max integer)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = p_id AND current_uses < p_max;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;
