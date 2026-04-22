-- ============================================================
-- Migration: schema inicial do sorteador de brindes
-- ============================================================

-- Configuração do evento
CREATE TABLE IF NOT EXISTS config (
  id              SERIAL PRIMARY KEY,
  event_name      TEXT        NOT NULL DEFAULT 'Sorteio de Brindes',
  total_prizes    INTEGER     NOT NULL DEFAULT 0,
  prizes_remaining INTEGER    NOT NULL DEFAULT 0,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prizes_remaining_non_negative CHECK (prizes_remaining >= 0),
  CONSTRAINT prizes_remaining_lte_total CHECK (prizes_remaining <= total_prizes),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- Ganhadores registrados
CREATE TABLE IF NOT EXISTS draws (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       INTEGER     NOT NULL REFERENCES config(id),
  winner_name     TEXT,
  winner_contact  TEXT,
  drawn_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log de acessos (apenas timestamp, sem dados pessoais)
CREATE TABLE IF NOT EXISTS accesses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       INTEGER     NOT NULL REFERENCES config(id),
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultas do algoritmo adaptativo (últimos N minutos)
CREATE INDEX IF NOT EXISTS accesses_config_time_idx
  ON accesses (config_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS draws_config_time_idx
  ON draws (config_id, drawn_at DESC);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER config_updated_at
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE draws    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accesses ENABLE ROW LEVEL SECURITY;

-- Qualquer um (anon) pode ler a config ativa (para a página de sorteio saber se o evento está ativo)
CREATE POLICY "config_public_read" ON config
  FOR SELECT
  TO anon
  USING (active = true);

-- Apenas autenticados (admin) podem modificar config
CREATE POLICY "config_admin_write" ON config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon NÃO pode ler draws (dados dos ganhadores são sensíveis)
-- Apenas authenticated (admin) pode ver
CREATE POLICY "draws_admin_read" ON draws
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon NÃO pode inserir draws diretamente — isso é feito pela Edge Function via service role
-- (service role bypassa RLS por padrão)

-- Accesses também são inseridos apenas via Edge Function (service role)
-- Admin pode ler para estatísticas
CREATE POLICY "accesses_admin_read" ON accesses
  FOR SELECT
  TO authenticated
  USING (true);
