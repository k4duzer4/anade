# Autoridade certificadora do Supabase

`supabase-prod-ca-2021.crt` é o certificado público Supabase Root 2021 CA. O cliente PostgreSQL o usa somente para hosts oficiais `*.pooler.supabase.com` e `*.supabase.co`, mantendo verificação de certificado e hostname. Não contém credenciais.

- Fonte HTTPS: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- Fonte do endereço no painel oficial: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json (`ssl:certificate_url`, ambiente `prod`).
- SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Validade até 26/04/2031. Atualize a partir da fonte oficial quando o Supabase trocar a CA.

Documentação: https://supabase.com/docs/guides/platform/ssl-enforcement
