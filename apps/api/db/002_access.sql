-- O schema anade não deve ser incluído nos schemas expostos pela Data API do Supabase.
-- Somente o backend conecta via DATABASE_URL; não há acesso direto do navegador.
ALTER TABLE anade.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.session ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA anade FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA anade FROM PUBLIC;
REVOKE ALL ON SCHEMA anade FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA anade FROM anon, authenticated;
