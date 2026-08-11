/**
 * Genera los dos módulos que el correo de bienvenida necesita como strings:
 *
 *   src/logo-base64.js     ← public/assets/droneitor-wordmark-light.png
 *   src/email-template.js  ← email/templates/droneitor-welcome-email.html
 *
 * Existen porque el Worker no tiene filesystem en tiempo de ejecución: ni el
 * PNG ni el .html se pueden leer desde src/index.js, así que se hornean en el
 * bundle. Volver a correr esto (`node scripts/build-email-assets.mjs`) es la
 * única forma soportada de actualizarlos — no editar los generados a mano.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOGO_SRC = "public/assets/droneitor-wordmark-light.png";
const TPL_SRC = "email/templates/droneitor-welcome-email.html";

// --- logo -----------------------------------------------------------------
// Base64 crudo, sin prefijo `data:image/png;base64,`: Zeptomail recibe el
// mime_type en su propio campo y espera sólo el contenido codificado.
const base64 = readFileSync(LOGO_SRC).toString("base64");
writeFileSync(
  "src/logo-base64.js",
  `// GENERADO por scripts/build-email-assets.mjs — no editar a mano.\n` +
    `// Fuente: ${LOGO_SRC}\n` +
    `export const LOGO_BASE64 = "${base64}";\n`
);

// --- plantilla ------------------------------------------------------------
const tpl = readFileSync(TPL_SRC, "utf8");

// El corte del bloque español no puede ser un simple "cortar desde ESPAÑOL en
// adelante": abajo del divisor sigue el pie de página (bilingüe, va en los dos
// idiomas) y los cierres del documento. Cortar hasta el final dejaría un HTML
// sin </table></body></html> y sin pie. Así que se aísla exactamente el tramo
// español: desde el <tr> del divisor hasta el <tr> del pie.
// Busca la fila de PRIMER NIVEL que contiene el ancla. Tomar sin más el <tr>
// anterior no sirve: el divisor «ESPAÑOL» vive dentro de una tabla anidada, y
// cortar por ahí parte la estructura al medio (deja un <table> sin cerrar en
// el tramo inglés). Las filas de primer nivel son las únicas cuyo <td> lleva
// colspan="2", y eso sí las identifica sin ambigüedad.
const trBefore = (needle) => {
  const at = tpl.indexOf(needle);
  if (at === -1) throw new Error(`No se encontró el ancla ${needle} en ${TPL_SRC}`);
  let tr = -1;
  for (let i = tpl.indexOf("<tr>"); i !== -1 && i < at; i = tpl.indexOf("<tr>", i + 1)) {
    if (/^\s*<td colspan="2"/.test(tpl.slice(i + "<tr>".length, i + 60))) tr = i;
  }
  if (tr === -1) throw new Error(`No hay <tr> de primer nivel antes de ${needle}`);
  return tr;
};

// Cada variante que se envía tiene que ser HTML balanceado por sí sola. Sin
// esto, recortar el bloque español pasa los tests de contenido y llega roto al
// cliente de correo, que es donde nadie lo mira.
const balanceado = (html) =>
  ["table", "tr", "td"].every(
    (t) =>
      (html.match(new RegExp(`<${t}[ >]`, "g")) || []).length ===
      (html.match(new RegExp(`</${t}>`, "g")) || []).length
  );

const esStart = trBefore("ESPAÑOL");
const footStart = trBefore('bgcolor="#071217"'); // primera fila del pie

if (!(esStart < footStart)) throw new Error("El divisor ESPAÑOL no precede al pie");

const parts = {
  HTML_HEAD: tpl.slice(0, esStart),
  HTML_ES: tpl.slice(esStart, footStart),
  HTML_FOOT: tpl.slice(footStart)
};

// La garantía que importa: los tres tramos reconstruyen el fichero tal cual,
// sin perder ni un byte de los estilos inline.
if (parts.HTML_HEAD + parts.HTML_ES + parts.HTML_FOOT !== tpl) {
  throw new Error("Los tramos no reconstruyen la plantilla original");
}

// La variante inglesa (head + foot, sin el bloque español) es la que puede
// quedar mal cortada; la española coincide con la plantilla entera y nunca lo
// delata. Se comprueban las dos igual.
for (const [variante, html] of [
  ["en", parts.HTML_HEAD + parts.HTML_FOOT],
  ["es", tpl]
]) {
  if (!balanceado(html)) throw new Error(`La variante ${variante} quedó con etiquetas sin cerrar`);
}

const lit = (s) => "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";

writeFileSync(
  "src/email-template.js",
  `// GENERADO por scripts/build-email-assets.mjs — no editar a mano.\n` +
    `// Fuente: ${TPL_SRC}\n` +
    `//\n` +
    `// HTML_HEAD + HTML_ES + HTML_FOOT reproduce la plantilla byte a byte.\n` +
    `// El correo en inglés es HTML_HEAD + HTML_FOOT: se salta el bloque español\n` +
    `// pero conserva el pie y los cierres del documento.\n` +
    Object.entries(parts)
      .map(([k, v]) => `export const ${k} = ${lit(v)};\n`)
      .join("\n")
);

console.log(
  `logo: ${base64.length} chars base64\n` +
    `plantilla: head ${parts.HTML_HEAD.length} / es ${parts.HTML_ES.length} / foot ${parts.HTML_FOOT.length} chars`
);
