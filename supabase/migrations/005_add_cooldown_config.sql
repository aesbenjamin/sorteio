-- ============================================================
-- Adiciona configuração de trava por dispositivo
-- ============================================================
ALTER TABLE config
  ADD COLUMN IF NOT EXISTS cooldown_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER  NOT NULL DEFAULT 60
  CONSTRAINT cooldown_minutes_positive CHECK (cooldown_minutes > 0);
