# Droneitor — Landing de generación de leads

Landing bilingüe (ES/EN) de una sola página para capturar leads a cambio de
un 10% de descuento en el primer servicio. HTML/CSS/JS plano — sin
framework ni build step.

## Estructura

```
public/
├── index.html
├── styles.css
├── script.js
└── assets/
    ├── droneitor-icon.png            (favicon)
    ├── droneitor-wordmark-light.png  (logo del header)
    ├── droneitor-wordmark-light.svg
    └── slide-1..5-*.jpg              (5 fotos reales del hero slider)
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

## Pendiente / no implementado

- Envío real del formulario a un endpoint (hay un `// TODO: fetch(...)`
  en `script.js` — actualmente solo hace `console.log` y muestra el
  estado de éxito).
- Los `.jpg` originales (sin usar, ~14.6&nbsp;MB) siguen en
  `public/assets/` sin referenciarse — se pueden borrar cuando quieras.
