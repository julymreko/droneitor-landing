-- Migration number: 0001 	 2026-08-08T18:00:00.000Z
-- Tabla de leads del formulario de la landing.

CREATE TABLE IF NOT EXISTS leads (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Datos del formulario
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  project_type     TEXT    NOT NULL,  -- real-estate | events | construction | other
  lang             TEXT    NOT NULL,  -- en | es

  -- Registro de consentimiento (FIPA / FTSA de Florida).
  -- Siempre 1: el servidor rechaza el envío si no viene aceptado.
  -- Vale junto con created_at + ip como prueba de consentimiento.
  consent          INTEGER NOT NULL,

  -- Atribución de campaña: esta landing recibe tráfico de anuncios pagados,
  -- así que sin esto no se sabe qué anuncio produjo qué lead.
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_content      TEXT,
  utm_term         TEXT,

  -- Geo que Cloudflare ya adjunta a la request (request.cf), sin lookup externo
  country          TEXT,
  region           TEXT,
  city             TEXT,

  -- Metadatos de la request. user_agent se guarda crudo a propósito:
  -- navegador y dispositivo se pueden derivar después si hacen falta.
  ip               TEXT,
  user_agent       TEXT,

  -- Respuesta de siteverify de Turnstile
  ts_success       INTEGER NOT NULL,
  ts_challenge_ts  TEXT,
  ts_hostname      TEXT,
  ts_action        TEXT,
  ts_cdata         TEXT,

  -- 0 mientras la réplica a Google Sheets no haya confirmado.
  -- D1 es la fuente de verdad; Sheets es una copia best-effort.
  synced_to_sheets INTEGER NOT NULL DEFAULT 0,

  created_at       TEXT    NOT NULL   -- ISO-8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_campaign   ON leads (utm_campaign);

-- Para encontrar rápido lo que falta re-sincronizar a la hoja.
CREATE INDEX IF NOT EXISTS idx_leads_unsynced   ON leads (synced_to_sheets)
  WHERE synced_to_sheets = 0;
