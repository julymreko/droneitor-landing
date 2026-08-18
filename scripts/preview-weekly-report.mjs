/**
 * Vista previa local del reporte semanal. No manda nada.
 *
 *   node scripts/preview-weekly-report.mjs
 *   node scripts/preview-weekly-report.mjs --week 2026-08-10
 *   node scripts/preview-weekly-report.mjs --remote
 *
 * Lee D1 a través de `wrangler d1 execute` y escribe el HTML y el texto en
 * ./preview/ para poder abrirlos en un navegador y en un editor. Es el paso 5
 * del flujo de aprobación: mirar el reporte antes de que exista cualquier
 * posibilidad de que salga por correo.
 *
 * Que use los MISMOS módulos que el Worker es lo que le da valor. Un preview
 * que reimplementara el render podría verse perfecto mientras producción manda
 * otra cosa.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { lastCompletedWeek, previousWeek } from "../src/reporting-window.js";
import { aggregate } from "../src/weekly-report-data.js";
import {
  buildSubject,
  formatMiamiDateTime,
  renderWeeklyReportHtml,
  renderWeeklyReportText
} from "../src/weekly-report-template.js";

const DB_NAME = "droneitor-leads";
const OUT_DIR = "preview";

const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const has = (flag) => process.argv.includes(flag);

const LOCATION = has("--remote") ? "--remote" : "--local";

// El entrypoint JS de wrangler, invocado con el mismo Node que corre esto.
//
// No se usa `npx` y hay motivo: con `shell: true` el shell de Windows vuelve a
// partir el SQL por sus comas y wrangler recibe "id,", "name,", … como
// argumentos sueltos; y sin shell no se puede lanzar `npx.cmd`, porque Node 18+
// rechaza spawnear .cmd/.bat sin shell (mitigación de CVE-2024-27980). Ejecutar
// el .js directamente esquiva las dos cosas y además es igual en Linux y macOS.
const WRANGLER_BIN = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Ejecuta una consulta contra D1 y devuelve las filas. */
function query(sql) {
  const raw = execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", DB_NAME, LOCATION, "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );

  // wrangler antepone banners al JSON; se recorta desde el primer corchete.
  const start = raw.indexOf("[");
  if (start === -1) throw new Error(`Respuesta inesperada de wrangler:\n${raw}`);

  const parsed = JSON.parse(raw.slice(start));
  return parsed[0]?.results ?? [];
}

/**
 * La semana a previsualizar. Con --week se fija el lunes concreto (el del seed);
 * sin él, la última semana completa respecto a ahora.
 */
function resolveWindow() {
  const pinned = arg("--week");
  if (!pinned) return lastCompletedWeek(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(pinned)) {
    throw new Error(`--week espera YYYY-MM-DD (el lunes de la semana), no "${pinned}"`);
  }

  // Situarse en la semana siguiente hace que "la última completa" sea la pedida.
  const inNextWeek = new Date(`${pinned}T12:00:00Z`);
  inNextWeek.setUTCDate(inNextWeek.getUTCDate() + 7);
  return lastCompletedWeek(inNextWeek);
}

const window = resolveWindow();
const prior = previousWeek(window);

console.log(`Ventana : ${window.periodLong}  (Miami)`);
console.log(`UTC     : ${window.startUtc} → ${window.endUtc}`);
console.log(`Origen  : D1 ${LOCATION.replace("--", "")}`);

const leads = query(
  `SELECT id, name, email, phone, project_type, lang,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          country, region, city, user_agent, created_at
     FROM leads
    WHERE created_at >= '${window.startUtc}' AND created_at < '${window.endUtc}'
    ORDER BY created_at DESC`
);

const previousRows = query(
  `SELECT COUNT(*) AS n FROM leads
    WHERE created_at >= '${prior.startUtc}' AND created_at < '${prior.endUtc}'`
);
const previousCount = previousRows[0]?.n ?? 0;

const model = aggregate({ leads, window, previousCount });

// El preview siempre se marca como test: el objetivo es verlo, y una captura
// de pantalla sin el aviso puede acabar confundiéndose con un envío real.
const context = {
  mode: "test",
  generatedAt: `${formatMiamiDateTime(new Date().toISOString())} (Miami time)`,
  salutation: "Julian"
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = path.join(OUT_DIR, `weekly-report-${window.periodKey}`);
fs.writeFileSync(`${base}.html`, renderWeeklyReportHtml(model, context), "utf8");
fs.writeFileSync(`${base}.txt`, renderWeeklyReportText(model, context), "utf8");

console.log(`\nAsunto  : ${buildSubject(model, context)}`);
console.log(`Leads   : ${model.total}  (semana previa: ${previousCount}, cambio ${model.change.label})`);
console.log(`Insight : ${model.insight}`);
console.log(`\nEscrito :\n  ${base}.html\n  ${base}.txt`);

if (model.total === 0) {
  console.log("\nAviso: sin leads en la ventana, el cron NO mandaría correo.");
}
