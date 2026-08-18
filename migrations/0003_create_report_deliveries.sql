-- Migration number: 0003 	 2026-08-17T22:00:00.000Z
-- Registro de entregas del reporte semanal.
--
-- Existe por idempotencia: los Cron Triggers de Cloudflare pueden reejecutarse
-- (reintento tras un fallo transitorio, redespliegue, disparo manual), y sin
-- esta tabla cada reintento mandaría otra vez el mismo reporte a Marco y Julian.
--
-- La clave es el lunes de Miami que abre la ventana, no la fecha de ejecución:
-- dos corridas del mismo lunes reportan el mismo periodo y tienen que colisionar.
-- El UNIQUE lo hace cumplir la base y no la lógica, así que dos invocaciones
-- concurrentes tampoco pueden pasar las dos.

CREATE TABLE IF NOT EXISTS report_deliveries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 'weekly-lead-report'. Se guarda para que un futuro reporte (mensual, por
  -- campaña) comparta tabla sin chocar de claves.
  report_type    TEXT    NOT NULL,

  -- Lunes de la ventana en hora de Miami, YYYY-MM-DD.
  period_key     TEXT    NOT NULL,

  -- Copia del intervalo consultado, para poder auditar qué se reportó sin
  -- recalcular la ventana con el código de hoy.
  period_start   TEXT    NOT NULL,   -- ISO-8601 UTC, inclusivo
  period_end     TEXT    NOT NULL,   -- ISO-8601 UTC, exclusivo

  -- 'test' | 'production'. El mismo periodo puede entregarse una vez en cada
  -- modo: la prueba a Julian no debe bloquear el envío real posterior.
  mode           TEXT    NOT NULL,

  lead_count     INTEGER NOT NULL,
  recipient_count INTEGER NOT NULL,

  -- 'pending' se escribe ANTES de llamar a Zeptomail y 'sent' después de que
  -- responda 2xx. La fila se reclama primero para que dos invocaciones
  -- simultáneas no puedan mandar las dos: la segunda choca contra el UNIQUE.
  -- Si el envío falla de forma transitoria, la reclamación se borra y el
  -- reintento puede volver a tomarla.
  status         TEXT    NOT NULL DEFAULT 'pending',

  -- Identificador que devuelve Zeptomail, para rastrear una entrega concreta
  -- en su panel. Nunca se guarda el token ni datos personales del lead.
  message_id     TEXT,

  claimed_at     TEXT    NOT NULL,   -- ISO-8601 UTC
  sent_at        TEXT                -- ISO-8601 UTC, null mientras esté pending
);

-- El candado de idempotencia.
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_deliveries_period
  ON report_deliveries (report_type, period_key, mode);
