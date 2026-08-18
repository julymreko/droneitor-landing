-- Borra EXACTAMENTE las filas que insertó seed-weekly-report.sql.
--
--   npm run seed:report:clean        (D1 local)
--
-- El filtro es la marca que el seed escribe en ts_cdata, no un rango de fechas:
-- un `DELETE FROM leads WHERE created_at BETWEEN ...` se llevaría por delante
-- cualquier lead real de esa misma semana. Con la marca, un lead real nunca
-- puede coincidir — ts_cdata solo lo rellena Turnstile y nunca con este valor.
--
-- Si esto llegara a ejecutarse contra una base sin datos sembrados, borra cero
-- filas en vez de causar daño.

DELETE FROM leads WHERE ts_cdata = 'seed:weekly-report';

-- El registro de entregas del periodo sembrado, para poder volver a probar el
-- envío sin que la idempotencia lo bloquee.
DELETE FROM report_deliveries
 WHERE report_type = 'weekly-lead-report'
   AND period_key IN ('2026-08-10', '2026-08-03');
