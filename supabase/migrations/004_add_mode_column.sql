-- ============================================================
-- Adiciona coluna mode à tabela config
-- Valores: 'normal' | 'force_win' | 'blocked'
-- ============================================================
ALTER TABLE config
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal'
  CONSTRAINT config_mode_check CHECK (mode IN ('normal', 'force_win', 'blocked'));
