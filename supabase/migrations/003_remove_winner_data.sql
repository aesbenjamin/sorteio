-- ============================================================
-- Remove colunas de dados pessoais da tabela draws
-- Os sorteios são registrados apenas com timestamp
-- ============================================================
ALTER TABLE draws DROP COLUMN IF EXISTS winner_name;
ALTER TABLE draws DROP COLUMN IF EXISTS winner_contact;

-- Remove também a policy de leitura admin de draws (não há mais dado sensível,
-- mas também não há necessidade de expor via admin)
DROP POLICY IF EXISTS "draws_admin_read" ON draws;
