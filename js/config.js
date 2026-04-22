// ============================================================
// Configuração do Supabase
// Substitua os valores abaixo após criar seu projeto no Supabase
// Settings > API > Project URL  e  Project API keys > anon public
// ============================================================
const SUPABASE_URL        = "https://kvxksqcberhgxidvtmvl.supabase.co";
const SUPABASE_ANON_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGtzcWNiZXJoZ3hpZHZ0bXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTgyNDIsImV4cCI6MjA5MjQzNDI0Mn0.bi97NplJKouAHko-z1qA0Sw5oegKbb1IYR860rygl7w";

// Tempo mínimo entre tentativas do mesmo dispositivo (em minutos)
const COOLDOWN_MINUTES    = 60;
