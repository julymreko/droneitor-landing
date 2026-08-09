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

```bash
npx wrangler deploy
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

## Pendiente / no implementado

- Los `.jpg` originales (sin usar, ~14.6&nbsp;MB) siguen en
  `public/assets/` sin referenciarse — se pueden borrar cuando quieras.
- No hay backfill automático de las filas con `synced_to_sheets = 0`; por
  ahora se consultan a mano con el SELECT de más arriba.
