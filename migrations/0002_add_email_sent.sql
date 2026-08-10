-- Migration number: 0002 	 2026-08-09T00:00:00.000Z
-- Añade el flag de envío del correo de bienvenida (Zeptomail), en el mismo
-- patrón que synced_to_sheets: D1 ya tiene el lead a salvo, esto sólo
-- registra si el correo salió o no, para poder ver y reintentar los que
-- fallaron sin tener que rastrear logs de Workers.

ALTER TABLE leads ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_email_unsent ON leads (email_sent)
  WHERE email_sent = 0;
