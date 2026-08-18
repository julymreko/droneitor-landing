-- Datos de prueba para el reporte semanal de leads.
--
--   npm run seed:report        (D1 local)
--
-- NUNCA contra la base de producción. Todas las filas llevan
-- ts_cdata = 'seed:weekly-report', que es lo que usa el cleanup para borrar
-- exactamente estas y nada más — sin esa marca haría falta un DELETE por rango
-- de fechas, que se llevaría por delante leads reales de la misma semana.
--
-- Los timestamps son fijos y no CURRENT_TIMESTAMP: el reporte tiene que dar
-- siempre lo mismo para poder comparar capturas y afirmar totales en los tests.
--
-- Semana reportada: lunes 10 a domingo 16 de agosto de 2026, hora de Miami
--   = [2026-08-10T04:00:00Z, 2026-08-17T04:00:00Z)   (EDT, UTC-4)
-- Semana previa (solo para el comparativo): 3 a 9 de agosto de 2026.
--
-- Totales esperados:
--   Semana reportada        15 leads
--   Semana previa           10 leads
--   Cambio semanal          +50%
--   Día más fuerte          viernes, 4 leads
--   Jueves                  0 leads  (ejercita la fila en cero)
--   Sin atribución          3 leads
--
-- Ninguna dirección es real: example.com está reservado por RFC 2606 y los
-- teléfonos usan el rango ficticio 555-01xx.

-- ===================================================================
-- SEMANA REPORTADA — 15 leads
-- ===================================================================

INSERT INTO leads
  (name, email, phone, project_type, lang, consent,
   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
   country, region, city, ip, user_agent,
   ts_success, ts_challenge_ts, ts_hostname, ts_action, ts_cdata, created_at)
VALUES

-- --- Lunes 10 (3) — el primero cae EXACTO en la apertura de la ventana ------
('Ana Ruiz', 'ana.ruiz@example.com', '305-555-0101', 'real-estate', 'en', 1,
 'google', 'cpc', 'miami-real-estate-aug', 'headline-a', 'aerial photography',
 'US', 'FL', 'Miami', '203.0.113.10', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36',
 1, '2026-08-10T04:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-10T04:00:00.000Z'),

-- Mayúsculas distintas y espacios alrededor: tiene que agruparse con 'google'.
('Carlos Mendoza', 'carlos.mendoza@example.com', '305-555-0102', 'construction', 'es', 1,
 ' Google ', 'CPC', 'Miami-Real-Estate-Aug', NULL, NULL,
 'US', 'FL', 'Hialeah', '203.0.113.11', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 1, '2026-08-10T14:30:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-10T14:30:00.000Z'),

-- Sin campaña: debe salir como "Not provided" y no romper el top de campañas.
('Priya Raghunathan-Whitfield', 'priya.r@example.com', '305-555-0103', 'events', 'en', 1,
 'instagram', 'paid_social', NULL, NULL, NULL,
 'US', 'FL', 'Miami Beach', '203.0.113.12', 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 1, '2026-08-10T21:15:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-10T21:15:00.000Z'),

-- --- Martes 11 (2) ---------------------------------------------------------
('Diego Fernández', 'diego.f@example.com', '305-555-0104', 'real-estate', 'es', 1,
 'facebook', 'paid_social', 'brickell-condos-summer-2026-retargeting-broad', NULL, NULL,
 'US', 'FL', 'Coral Gables', '203.0.113.13', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36',
 1, '2026-08-11T13:05:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-11T13:05:00.000Z'),

-- Todos los UTM ausentes: tráfico sin atribuir.
('Emily Chen', 'emily.chen@example.com', '305-555-0105', 'other', 'en', 1,
 NULL, NULL, NULL, NULL, NULL,
 'US', 'FL', 'Fort Lauderdale', '203.0.113.14', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
 1, '2026-08-11T23:40:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-11T23:40:00.000Z'),

-- --- Miércoles 12 (1) — geolocalización parcial -----------------------------
('Marcus Oyelaran', 'marcus.o@example.com', '305-555-0106', 'construction', 'en', 1,
 'google', 'organic', NULL, NULL, NULL,
 NULL, NULL, NULL, '203.0.113.15', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36',
 1, '2026-08-12T16:20:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-12T16:20:00.000Z'),

-- --- Jueves 13: ninguno, a propósito ---------------------------------------

-- --- Viernes 14 (4) — el día más fuerte ------------------------------------
('Sofía Restrepo', 'sofia.r@example.com', '305-555-0107', 'events', 'es', 1,
 'GOOGLE', 'cpc', 'eventos-miami-agosto', 'video-15s', 'drone eventos',
 'US', 'FL', 'Miami', '203.0.113.16', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 1, '2026-08-14T11:10:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-14T11:10:00.000Z'),

('James Whitmore', 'james.w@example.com', '305-555-0108', 'real-estate', 'en', 1,
 'instagram', 'paid_social', 'listing-reels-aug', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.17', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/127.0',
 1, '2026-08-14T15:45:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-14T15:45:00.000Z'),

-- Campos opcionales vacíos en vez de NULL: el otro sabor de "sin dato".
('Lucía Márquez', 'lucia.m@example.com', '305-555-0109', 'other', 'es', 1,
 '', '', '', '', '',
 'US', 'FL', 'Doral', '203.0.113.18', 'Mozilla/5.0 (Linux; Android 13; SM-X200 Tablet) AppleWebKit/537.36 Chrome/127.0 Safari/537.36',
 1, '2026-08-14T19:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-14T19:00:00.000Z'),

-- User agent que no es ningún navegador conocido: debe caer en "Other".
('Tomás Iglesias', 'tomas.i@example.com', '305-555-0110', 'construction', 'es', 1,
 'facebook', 'paid_social', 'obra-progreso-2026', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.19', 'SomeUnknownClient/2.1 (+https://example.com/bot)',
 1, '2026-08-14T22:30:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-14T22:30:00.000Z'),

-- --- Sábado 15 (2) ---------------------------------------------------------
('Rachel Osei', 'rachel.osei@example.com', '305-555-0111', 'events', 'en', 1,
 'instagram', 'paid_social', 'listing-reels-aug', NULL, NULL,
 'US', 'FL', 'Miami Beach', '203.0.113.20', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 1, '2026-08-15T17:25:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-15T17:25:00.000Z'),

('Ricardo Salazar', 'ricardo.s@example.com', '305-555-0112', 'real-estate', 'es', 1,
 NULL, NULL, NULL, NULL, NULL,
 'US', 'FL', 'Key Biscayne', '203.0.113.21', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0 Safari/537.36',
 1, '2026-08-15T20:50:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-15T20:50:00.000Z'),

-- --- Domingo 16 (3) — el último cae 1 minuto antes del cierre ---------------
('Grace Adeyemi', 'grace.a@example.com', '305-555-0113', 'real-estate', 'en', 1,
 'google', 'cpc', 'miami-real-estate-aug', 'headline-b', 'aerial video',
 'US', 'FL', 'Aventura', '203.0.113.22', 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36',
 1, '2026-08-16T14:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-16T14:00:00.000Z'),

('Antonio Villaseñor de la Cruz', 'antonio.v@example.com', '305-555-0114', 'other', 'es', 1,
 NULL, 'referral', NULL, NULL, NULL,
 'CA', 'ON', 'Toronto', '203.0.113.23', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
 1, '2026-08-16T18:35:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-16T18:35:00.000Z'),

-- 23:59 del domingo en Miami. Si la ventana estuviera mal cerrada, esta fila
-- se perdería o se contaría en la semana siguiente.
('Nadia Petrova', 'nadia.p@example.com', '305-555-0115', 'events', 'en', 1,
 'google', 'cpc', 'eventos-miami-agosto', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.24', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
 1, '2026-08-17T03:59:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-17T03:59:00.000Z'),

-- ===================================================================
-- SEMANA PREVIA — 10 leads, solo para el comparativo
--
-- El primero cae 1 minuto ANTES de que abra la ventana reportada: si el
-- intervalo estuviera mal, aparecería en el reporte y el total daría 16.
-- ===================================================================

('Prev Lead 01', 'prev01@example.com', '305-555-0201', 'real-estate', 'en', 1,
 'google', 'cpc', 'miami-real-estate-aug', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.30', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0',
 1, '2026-08-10T03:59:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-10T03:59:00.000Z'),

('Prev Lead 02', 'prev02@example.com', '305-555-0202', 'events', 'es', 1,
 'facebook', 'paid_social', 'eventos-julio', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.31', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148',
 1, '2026-08-04T12:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-04T12:00:00.000Z'),

('Prev Lead 03', 'prev03@example.com', '305-555-0203', 'construction', 'en', 1,
 'google', 'cpc', 'obra-julio', NULL, NULL,
 'US', 'FL', 'Hialeah', '203.0.113.32', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
 1, '2026-08-04T18:30:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-04T18:30:00.000Z'),

('Prev Lead 04', 'prev04@example.com', '305-555-0204', 'real-estate', 'en', 1,
 NULL, NULL, NULL, NULL, NULL,
 'US', 'FL', 'Doral', '203.0.113.33', 'Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36',
 1, '2026-08-05T14:10:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-05T14:10:00.000Z'),

('Prev Lead 05', 'prev05@example.com', '305-555-0205', 'other', 'es', 1,
 'instagram', 'paid_social', 'reels-julio', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.34', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) Mobile/15E148',
 1, '2026-08-05T20:45:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-05T20:45:00.000Z'),

('Prev Lead 06', 'prev06@example.com', '305-555-0206', 'events', 'en', 1,
 'google', 'cpc', 'eventos-julio', NULL, NULL,
 'US', 'FL', 'Miami Beach', '203.0.113.35', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0',
 1, '2026-08-06T11:20:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-06T11:20:00.000Z'),

('Prev Lead 07', 'prev07@example.com', '305-555-0207', 'real-estate', 'es', 1,
 'facebook', 'paid_social', 'brickell-julio', NULL, NULL,
 'US', 'FL', 'Coral Gables', '203.0.113.36', 'Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36',
 1, '2026-08-06T19:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-06T19:00:00.000Z'),

('Prev Lead 08', 'prev08@example.com', '305-555-0208', 'construction', 'en', 1,
 'google', 'cpc', 'obra-julio', NULL, NULL,
 'US', 'FL', 'Fort Lauderdale', '203.0.113.37', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/127.0',
 1, '2026-08-07T15:30:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-07T15:30:00.000Z'),

('Prev Lead 09', 'prev09@example.com', '305-555-0209', 'other', 'en', 1,
 'instagram', 'paid_social', 'reels-julio', NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.38', 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Mobile/15E148',
 1, '2026-08-08T16:00:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-08T16:00:00.000Z'),

('Prev Lead 10', 'prev10@example.com', '305-555-0210', 'events', 'es', 1,
 NULL, NULL, NULL, NULL, NULL,
 'US', 'FL', 'Miami', '203.0.113.39', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
 1, '2026-08-09T13:45:00Z', 'fly.droneitor.com', 'lead', 'seed:weekly-report', '2026-08-09T13:45:00.000Z');
