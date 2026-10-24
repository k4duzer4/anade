CREATE TABLE IF NOT EXISTS anade.organization_records (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('group','note','wallet','entry','legal','event','file','notification')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_kind ON anade.organization_records(kind,created_at DESC,id);
CREATE TABLE IF NOT EXISTS anade.notification_reads (
  account_id text NOT NULL REFERENCES anade.accounts(id),
  notification_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,notification_key)
);
ALTER TABLE anade.polls ADD COLUMN IF NOT EXISTS governance jsonb;
ALTER TABLE anade.meetings ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES anade.organization_records(id);
INSERT INTO anade.organization_records(id,kind,data) VALUES
 ('10000000-0000-4000-8000-000000000001','group','{"name":"Bancada da Câmara","type":"camara","memberIds":[],"leaderId":"","state":"","description":"Parlamentares, liderança e pautas da Câmara."}'),
 ('10000000-0000-4000-8000-000000000002','group','{"name":"Bancada do Senado","type":"senado","memberIds":[],"leaderId":"","state":"","description":"Parlamentares, liderança e pautas do Senado."}'),
 ('10000000-0000-4000-8000-000000000003','group','{"name":"Direção nacional","type":"direcao","memberIds":[],"leaderId":"","state":"","description":"Coordenação nacional da ANADE."}'),
 ('10000000-0000-4000-8000-000000000004','group','{"name":"Jurídico","type":"juridico","memberIds":[],"leaderId":"","state":"","description":"Equipe de acompanhamento jurídico."}'),
 ('10000000-0000-4000-8000-000000000005','group','{"name":"Comunicação","type":"comunicacao","memberIds":[],"leaderId":"","state":"","description":"Planejamento da comunicação do partido."}'),
 ('10000000-0000-4000-8000-000000000006','group','{"name":"Tesouraria","type":"tesouraria","memberIds":[],"leaderId":"","state":"","description":"Equipe de gestão financeira."}')
ON CONFLICT DO NOTHING;
INSERT INTO anade.organization_records(id,kind,data) VALUES
 ('20000000-0000-4000-8000-000000000001','wallet','{"name":"Caixa partidário","type":"partidario","memberIds":[]}'),
 ('20000000-0000-4000-8000-000000000002','wallet','{"name":"Fundo eleitoral","type":"fundo","memberIds":[]}')
ON CONFLICT DO NOTHING;
ALTER TABLE anade.organization_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.organization_records,anade.notification_reads FROM PUBLIC,anon,authenticated;
