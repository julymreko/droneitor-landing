# Droneitor — Landing de generación de leads

Landing bilingüe (ES/EN) de una sola página para capturar leads a cambio de
un 10% de descuento en el primer servicio. HTML/CSS/JS plano — sin
framework ni build step.

## Estructura

```
public/                              (assets estáticos, sin build step)
├── index.html
├── styles.css
├── script.js
└── assets/
    ├── droneitor-icon.png            (favicon)
    ├── droneitor-wordmark-light.png  (logo del header)
    ├── droneitor-wordmark-light.svg
    └── slide-1..5-*.jpg              (5 fotos reales del hero slider)
src/                                 (Worker de captura de leads)
├── index.js                          entrada: POST /api/lead
├── validate.js                       validación de servidor (pura)
├── turnstile.js                      verificación del token de Turnstile
└── sheets.js                         réplica a Google Sheets (service account)
migrations/
└── 0001_create_leads.sql
test/                                (vitest, sólo dev)
wrangler.jsonc
```

## Identidad visual — fuente de verdad

Construido sobre el archivo de diseño `Droneitor Landing.dc.html`
(Claude Design), con dos correcciones confirmadas tras verificar en vivo
droneitor.com con Chrome DevTools:

- **Tipografía:** Poppins (selector de idioma) · Roboto (eyebrow y
  subtítulo del hero, telemetría, footer) · Playfair Display (solo el
  título del hero, sobre el slider) · Avenir Roman (cuerpo de texto y
  títulos generales — form, beneficios) · Avenir Black (botones).
  Avenir es una fuente comercial no redistribuible como webfont; se
  declara primero en la pila y **Nunito Sans** (Google Fonts) queda como
  fallback real cargado para quien no la tenga instalada.
- **Color:** cian `#00BEE6` como único acento, sobre fondo casi negro
  (`oklch(14% 0.012 240)`). Sin naranja ni rosa/magenta.

Se descartaron como referencia: la especificación `.md` original
(paleta oscura/naranja, Space Grotesk/Inter/Space Mono) y el intento
previo en `claude/design/mockup/` (paleta clara, Kanit/Montserrat) — ver
el hilo de la conversación para el detalle de por qué.

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue (Cloudflare Workers, static assets)

> **Cada push a `main` sale a producción automáticamente.**
> Cloudflare está conectado al repo y despliega solo: no hay que ejecutar
> nada a mano. Un push es un despliegue — no hay paso intermedio de
> revisión, ni entorno de staging. Lo que se mergea a `main` queda sirviendo
> en `fly.droneitor.com` en un par de minutos.

Como el formulario ya captura leads reales, un push que rompa `src/` o el
`<form>` deja de capturar leads pagados hasta el siguiente arreglo. Antes de
pushear a `main`:

```bash
npm test        # validación y firma del JWT
npm run dev     # humo manual del formulario contra D1 local
```

`npm run deploy:emergency` (o `npx wrangler deploy`) sigue funcionando y
despliega desde el working directory local, saltándose git. **Normalmente no
es lo que quieres**: deja producción sirviendo código que no está en `main`,
y el siguiente push lo sobrescribe sin avisar. Está nombrado así justamente
para que no parezca la vía normal — úsalo sólo para un rollback de
emergencia, y en ese caso vuelve a dejar `main` en el estado bueno cuanto
antes.

Ver despliegues y volver atrás:

```bash
npx wrangler deployments list
npx wrangler rollback [<version-id>]
```

`wrangler.jsonc` apunta `assets.directory` a `./public`. Si el nombre del
Worker configurado en Cloudflare no es `droneitor-landing`, ajusta el
campo `name` en `wrangler.jsonc` para que coincida.

## Rendimiento — hero LCP

Cada foto del slider tiene 3 tamaños WebP (`-900w`, `-1600w`, sin sufijo
= ~2880w) servidos vía `srcset`/`sizes="100vw"`. La foto 1 (candidata a
LCP) carga con `fetchpriority="high"` + `<link rel="preload" imagesrcset>`
en el `<head>`. Las fotos 2–5 no tienen `src` en el HTML (solo
`data-src`/`data-srcset`): como las 5 ocupan el mismo rect
(`position:absolute inset:0`), un `loading="lazy"` nativo no las difiere
de verdad — el `src` real se asigna por JS recién después de `window.load`,
para que no compitan por ancho de banda con la imagen del LCP.

Verificado con `chrome-devtools-mcp` (trace + red fría, contexto aislado,
Slow 4G + CPU×4, servido por HTTP local, no `file://`): LCP ≈ 570&nbsp;ms
en mobile bajo esas condiciones simuladas — los números absolutos no son
1:1 con producción (falta el RTT real de la CDN), pero confirman que el
mecanismo (imagen correcta según viewport + diferido real de las otras 4)
funciona.

## Backend — captura de leads (Cloudflare Workers + D1)

Nada de PHP ni del VPS que hospeda el sitio principal: el formulario hace
`POST /api/lead` a un Worker en este mismo repo.

Es un **Worker híbrido**: Cloudflare sirve primero cualquier fichero de
`public/` y sólo ejecuta `src/index.js` cuando la ruta no es un asset. Por
eso no hacen falta patrones de ruta, y una visita normal a la landing no
consume ni una invocación del Worker.

### Flujo de una petición

```
POST /api/lead
  ├─ guardas: método, content-type, tamaño máximo (8 KB)
  ├─ validación de servidor  ── falla → 400 {ok:false, errors:[campo,…]}
  ├─ verificación de Turnstile ─ falla → 403, y NO se guarda nada
  ├─ INSERT en D1            ── falla → 500 {ok:false}
  ├─ 200 {ok:true}  ← el cliente sólo muestra éxito con esta respuesta
  └─ ctx.waitUntil( append a Google Sheets → synced_to_sheets = 1 )
```

**D1 es la fuente de verdad y Sheets una copia best-effort.** Una vez que la
fila está en D1 el lead está a salvo, así que se responde éxito aunque Google
falle: una caída de Sheets no puede mostrarle un error a alguien que llegó
por un anuncio pagado. Lo que no se sincronizó queda con
`synced_to_sheets = 0` para poder rellenarlo después:

```sql
SELECT * FROM leads WHERE synced_to_sheets = 0 ORDER BY created_at;
```

### Qué se guarda y por qué

Además de los datos del formulario:

- **`consent` + `created_at` + `ip`** — es el registro de consentimiento que
  respalda el aviso de FIPA/FTSA del propio formulario. El servidor rechaza
  el envío si `consent` no llega como booleano `true`.
- **`utm_*`** — esta landing recibe tráfico de anuncios pagados; sin esto no
  hay forma de saber qué campaña produjo qué lead. Se leen del query string
  al cargar y se guardan en `sessionStorage`, para no perder la atribución
  si el visitante recarga o llega por una URL ya limpia antes de enviar.
- **`country` / `region` / `city`** — vienen de `request.cf`, que Cloudflare
  ya adjunta a la request en el edge. Sin lookup externo ni coste.
- **`user_agent` crudo** — a propósito sin parsear: navegador y dispositivo
  se pueden derivar del string después si alguna vez hacen falta.

### Puesta en marcha

Ya hecho (no hace falta repetirlo):

- Base D1 `droneitor-leads` creada **con `--location enam`** y su esquema
  aplicado en remoto. La región se fija al crear: como el `INSERT` se espera
  antes de responder al visitante y el público es de Florida, dejarla en
  WNAM (donde cae por defecto) metía un salto de costa a costa en el tiempo
  percibido de envío.
- Widget de Turnstile de producción creado y `TURNSTILE_SECRET_KEY` subido.

Pendiente — necesita la consola de Google Cloud:

```bash
npx wrangler secret put GOOGLE_SA_EMAIL
npx wrangler secret put GOOGLE_SA_PRIVATE_KEY
npx wrangler secret put GOOGLE_SHEET_ID
```

Pendiente — necesita la consola de Zeptomail (correo de bienvenida). El
dominio del remitente (`ZEPTOMAIL_FROM_EMAIL` en `wrangler.jsonc`) tiene que
estar verificado en la cuenta o el envío falla:

```bash
npx wrangler secret put ZEPTOMAIL_API_KEY
```

Para desarrollo local, los mismos valores van en `.dev.vars` (ya está en
`.gitignore`) y el esquema se aplica con `npm run migrate:local`.

Para desarrollo local los secretos van en `.dev.vars` (ya está en
`.gitignore`). Ojo: **wrangler no recarga `.dev.vars` en caliente** — hay que
reiniciar `npm run dev` tras cambiarlo, o seguirá usando el valor anterior
sin avisar.

### Turnstile

Sustituye el checkbox falso y la insignia de "reCAPTCHA" que había antes. El
widget se renderiza por JS (`render=explicit`) en vez de con
`class="cf-turnstile"` porque un widget ya montado no puede cambiar de
idioma: con el toggle ES/EN hay que destruirlo y recrearlo.

El widget de producción ya está creado: **"Droneitor landing"**, modo
`managed`, dominio `fly.droneitor.com`. Su sitekey está en
`public/script.js` y su secreto ya está subido como secreto del Worker.

```bash
npx wrangler turnstile widget list
npx wrangler turnstile widget get <sitekey>   # el secreto sólo se ve aquí
```

Como el sitekey sólo resuelve en `fly.droneitor.com`, para desarrollo local
hay que cambiar temporalmente `TURNSTILE_SITE_KEY` en `public/script.js` por
la clave de prueba de Cloudflare `1x00000000000000000000AA` (siempre
aprueba), con su secreto `1x0000000000000000000000000000000AA` en
`.dev.vars`. Para probar el camino de rechazo, el secreto
`2x0000000000000000000000000000000AA` siempre falla.

El token es de un solo uso y caduca a los ~5 min, por eso el cliente llama a
`turnstile.reset()` después de cualquier envío fallido; sin eso, el reintento
fallaría siempre con `timeout-or-duplicate`.

El `<script>` de Turnstile se carga sin `integrity`: Cloudflare publica
`api.js` sin versionar y lo actualiza sin avisar, así que fijar un hash SRI
rompería el widget —  y con él, todos los envíos— en cuanto lo cambien.

### Google Sheets

Service account con JWT firmado en RS256 vía Web Crypto (nativo en Workers,
sin dependencias ni `nodejs_compat`). Alta una sola vez:

1. Habilitar la Google Sheets API en un proyecto de Google Cloud.
2. Crear una service account y descargar su clave JSON.
3. **Compartir la hoja** con el email `…iam.gserviceaccount.com` de esa
   cuenta, con permiso de edición. Sin este paso el append da 403.
4. Crear en la hoja una pestaña `Leads` con una fila de encabezados en este
   orden (el mismo de `SHEET_COLUMNS` en `src/sheets.js`):

```
created_at · name · email · phone · project_type · lang ·
utm_source · utm_medium · utm_campaign · utm_content · utm_term ·
country · region · city · ip · user_agent · id
```

Se escribe con `valueInputOption=RAW`, así que Sheets no evalúa fórmulas; aun
así los valores que empiezan por `= + - @` se escapan con `'`, porque estas
hojas se exportan a CSV y Excel **sí** las ejecuta al abrirlas.

## Tests

```bash
npm test
```

Cobertura deliberadamente estrecha: `src/validate.js` y la firma del JWT de
`src/sheets.js`. Son las piezas donde un fallo silencioso pierde leads
pagados sin que nadie se entere — el resto se verifica a mano contra
`wrangler dev`. No pretende ser una suite completa que mantener.

## Reporte semanal de leads (interno)

Correo ejecutivo que resume los leads de la última semana completa. Va a
Droneitor y 2DM, **no** al lead. Siempre en inglés, independientemente del
idioma con que cada lead llenó el formulario.

| Pieza | Archivo |
| --- | --- |
| Ventana lunes–domingo Miami → UTC | `src/reporting-window.js` |
| Consulta, normalización y agregados | `src/weekly-report-data.js` |
| Render HTML + texto plano | `src/weekly-report-template.js` |
| Orquestación, destinatarios y envío | `src/weekly-report.js` |
| Registro de entregas (idempotencia) | `migrations/0003_create_report_deliveries.sql` |

Dispara con un Cron Trigger los lunes a las **06:00 UTC**. Esa hora no decide
qué semana se reporta: la ventana se deriva del instante de ejecución, así que
un cron fijo en UTC sigue siendo correcto cuando Miami cambia de horario, y un
reintento a otra hora del mismo lunes reporta exactamente lo mismo.

Si la semana cerró con **cero leads no se manda nada**: un correo que dice "0"
cada lunes enseña a ignorar el reporte.

### Modo test y modo producción

`REPORT_MODE` en `wrangler.jsonc` es el único interruptor. Vale `test` —
manda solo a Julian y antepone `[TEST]` al asunto — o `production`, que
habilita también a Marco.

Cualquier otro valor (un typo, la variable sin definir, un valor heredado)
se trata como `test`. El fallo por defecto nunca puede ser escribirle al
cliente.

### Flujo de prueba local

```bash
npm run migrate:local        # crea report_deliveries
npm run seed:report          # 15 leads en la semana del 10–16 ago 2026 + 10 la previa
npm run report:preview -- --week 2026-08-10
```

El preview escribe `preview/weekly-report-2026-08-10.html` y `.txt` usando los
mismos módulos que el Worker, y **no manda nada**. Ábrelo en el navegador y
revísalo en claro y en oscuro, en ancho de escritorio y de móvil.

Totales esperados con esos datos: 15 leads, semana previa 10, cambio +50%,
viernes el día más fuerte con 4, jueves en cero.

Para limpiar:

```bash
npm run seed:report:clean
```

Borra por la marca `ts_cdata = 'seed:weekly-report'`, no por rango de fechas —
un DELETE por fechas se llevaría por delante leads reales de esa semana.

### El token de Zeptomail es otro

El reporte sale de `support@droneitor.com`, que en Zeptomail pertenece a un
**Mail Agent distinto** del que manda `no-reply@droneitor.com` a los leads.
Cada Mail Agent firma con su propio *Send Mail Token*, y el remitente tiene que
pertenecer al agente que firma — con el token equivocado la API responde 401
aunque el dominio esté verificado.

Por eso el reporte lee su propio secreto:

```bash
npx wrangler secret put REPORT_ZEPTOMAIL_API_KEY   # token del agente de support@
```

En local va en `.dev.vars` con el mismo nombre. Si no está definido, el reporte
cae en `ZEPTOMAIL_API_KEY` — cómodo si algún día los dos remitentes acaban en el
mismo agente, pero hoy eso daría 401.

Sin ningún token, el reporte no intenta el envío y registra
`status: "skipped_no_api_key"`, para que no se confunda un secreto ausente con
un rechazo de Zeptomail.

### Envío de prueba real

Requiere `REPORT_ZEPTOMAIL_API_KEY` en `.dev.vars`. Con `REPORT_MODE=test` el
destinatario solo puede ser Julian.

```bash
npx wrangler dev --var REPORT_DRY_RUN:true
# en otra terminal — los Cron Triggers no se disparan solos en local:
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

Con `REPORT_DRY_RUN:true` genera el reporte y lo registra en el log **sin**
llamar a Zeptomail. Quítalo del comando solo cuando quieras que salga el correo
de verdad:

```bash
npx wrangler dev
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

El dry-run deja una línea así:

```json
{"report":"weekly-lead-report","mode":"test","period":"2026-08-10",
 "leadCount":15,"recipientCount":1,"status":"dry_run"}
```

La fecha de la máquina decide qué semana se reporta. Para que coincida con los
datos sembrados hay que correrlo un lunes de la semana siguiente, o sembrar la
semana que corresponda a hoy.

### Habilitar producción

Un solo cambio, y a propósito:

```jsonc
"REPORT_MODE": "production"
```

Luego `npx wrangler deploy`. A partir de ahí Marco recibe el reporte. No lo
toques hasta que el reporte esté aprobado.

### Idempotencia

Cada entrega se registra en `report_deliveries` con clave
`(report_type, period_key, mode)`. El periodo se **reclama antes** de llamar a
Zeptomail, no después: la exclusión la garantiza el índice UNIQUE de la base y
no una comprobación en JavaScript, que dejaría una ventana entre el SELECT y el
INSERT.

Si el envío falla, la reclamación se libera y el siguiente intento puede
tomarla. Si el Worker muere en mitad del envío, la fila queda en `pending` y
bloquea ese periodo — es el lado seguro del fallo, pero hay que borrarla a mano
para reintentar:

```sql
DELETE FROM report_deliveries
 WHERE period_key = '2026-08-10' AND status = 'pending';
```

Modo test y modo producción llevan registros separados, así que probar un
periodo no impide mandarlo de verdad después.

## Pendiente / no implementado

- Los `.jpg` originales (sin usar, ~14.6&nbsp;MB) siguen en
  `public/assets/` sin referenciarse — se pueden borrar cuando quieras.
- No hay backfill automático de las filas con `synced_to_sheets = 0`; por
  ahora se consultan a mano con el SELECT de más arriba.
- El reporte semanal manda a todos los leads de la semana en una sola tabla.
  El renderer está partido para poder añadir después un límite de filas y un
  CSV adjunto sin tocar la agregación, pero no están implementados.
- `support@droneitor.com` como remitente del reporte **no está verificado
  todavía** contra Zeptomail. El dominio sí lo está, así que debería funcionar;
  se confirma en el primer envío de prueba.
