-- ============================================================
-- Função atômica para decrementar prizes_remaining
-- Retorna TRUE se conseguiu reservar um brinde, FALSE se esgotado
-- ============================================================
CREATE OR REPLACE FUNCTION try_claim_prize(p_config_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE config
  SET prizes_remaining = prizes_remaining - 1
  WHERE id = p_config_id
    AND prizes_remaining > 0
    AND active = true;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;
