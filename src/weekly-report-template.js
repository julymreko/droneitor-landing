/**
 * Render del reporte semanal: HTML para correo y su equivalente en texto plano.
 *
 * A diferencia de email-template.js, acá no hay una plantilla con placeholders
 * `{campo}`: el reporte tiene tablas de largo variable, así que se construye a
 * partir del modelo que devuelve weekly-report-data.js. Cada valor se escapa en
 * el punto de inserción, que es el único sitio que sabe si va a texto, a
 * atributo o a URL.
 *
 * Reglas de correo que condicionan todo lo de abajo (§7 del brief):
 *
 * - Layout con tablas, no flex ni grid: Outlook usa el motor de Word.
 * - Estilos en línea. Un <style> en el head lo descartan varios clientes.
 * - Colores de fondo Y de texto explícitos en cada celda. Si solo se declara
 *   uno, el modo oscuro de Gmail o de Outlook cambia el otro y deja texto
 *   ilegible sobre su propio fondo.
 * - Nada de prefers-color-scheme: no se puede confiar en que el cliente lo
 *   respete, así que el diseño es claro y neutro en todos lados.
 * - Ni emoji ni imágenes con texto: si el cliente bloquea imágenes o no tiene
 *   la fuente de emoji, el dato tiene que seguir ahí.
 */

import { DAY_NAMES, TIME_BUCKETS } from "./weekly-report-data.js";

const NAVY = "#152945";
const TERRACOTTA = "#c9603c";
const WHITE = "#ffffff";
const PAGE_BG = "#f3f5f7";
const PANEL_BG = "#ffffff";
const SOFT_BG = "#eef1f5";
const DIVIDER = "#d7dce2";
const TEXT = "#1f2937";
const TEXT_SOFT = "#4b5563";
const POSITIVE = "#1b6b3a";
const NEGATIVE = "#a3231b";

const FONT = "Arial, Helvetica, sans-serif";
const MAX_WIDTH = 680;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa para texto y para atributo a la vez: incluye comillas simples. */
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * Un mailto sólo si la dirección tiene forma de dirección.
 *
 * Se valida antes de construir la URL en vez de escapar después: un valor que
 * no es un email no se arregla escapándolo, y un `mailto:` con basura dentro es
 * un enlace que puede llevar a cualquier parte. Sin coincidencia, se devuelve
 * null y el renderer muestra el texto sin enlazar.
 */
export function safeMailto(email) {
  const value = String(email ?? "").trim();
  if (!/^[^\s@<>"']+@[^\s@<>"'.]+\.[^\s@<>"']+$/.test(value)) return null;
  return `mailto:${encodeURIComponent(value)}`;
}

/** Un tel: con solo dígitos y un + inicial opcional; el resto se descarta. */
export function safeTel(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (digits.replace(/\D/g, "").length < 7) return null;
  return `tel:${digits}`;
}

/** Enlace si el destino es válido; si no, el texto tal cual, siempre escapado. */
function link(href, label) {
  const safeLabel = escapeHtml(label);
  if (!href) return safeLabel;
  return `<a href="${escapeHtml(href)}" style="color:${NAVY};text-decoration:underline;">${safeLabel}</a>`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ *
 * Asunto
 * ------------------------------------------------------------------ */

export function buildSubject(model, { mode }) {
  const leads = plural(model.total, "lead", "leads");
  const subject = `Droneitor | Weekly Lead Report | ${model.window.periodShort} | ${leads}`;
  return mode === "production" ? subject : `[TEST] ${subject}`;
}

/* ------------------------------------------------------------------ *
 * Piezas HTML
 * ------------------------------------------------------------------ */

const cell = (content, extra = "") =>
  `<td style="padding:10px 12px;font-family:${FONT};font-size:14px;line-height:20px;color:${TEXT};background-color:${PANEL_BG};border-bottom:1px solid ${DIVIDER};${extra}">${content}</td>`;

const headCell = (content, extra = "") =>
  `<th align="left" style="padding:10px 12px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:${WHITE};background-color:${NAVY};${extra}">${content}</th>`;

/** Título de sección: barra terracota + texto, sin depender de imágenes. */
function sectionTitle(title) {
  return `
  <tr>
    <td style="padding:28px 24px 10px 24px;background-color:${PANEL_BG};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="width:4px;background-color:${TERRACOTTA};font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${NAVY};">${escapeHtml(title)}</td>
      </tr></table>
    </td>
  </tr>`;
}

/**
 * Tabla de datos. Se mantiene como <table> semántica (no presentation) con
 * <th>: es información tabular de verdad y así los lectores de pantalla la
 * anuncian como tabla.
 */
function dataTable(headers, rows) {
  if (!rows.length) {
    return `<tr><td style="padding:0 24px 8px 24px;background-color:${PANEL_BG};font-family:${FONT};font-size:14px;color:${TEXT_SOFT};">No data for this period.</td></tr>`;
  }

  const head = headers.map((h, i) => headCell(escapeHtml(h), i > 0 ? "text-align:right;" : "")).join("");
  const body = rows
    .map((cells) => `<tr>${cells.map((c, i) => cell(c, i > 0 ? "text-align:right;" : "")).join("")}</tr>`)
    .join("");

  return `
  <tr>
    <td style="padding:0 24px 8px 24px;background-color:${PANEL_BG};">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;background-color:${PANEL_BG};">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </td>
  </tr>`;
}

/**
 * Los cuatro KPI en dos filas de dos.
 *
 * No es estética: cuatro columnas en 680px dan 170px cada una, que en un móvil
 * de 320px se rompen o se hacen ilegibles. Dos por fila aguantan la reducción
 * sin necesitar media queries, que es lo que no se puede dar por soportado.
 */
function kpiGrid(items) {
  const box = (item) => `
    <td width="50%" style="padding:6px;" valign="top">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${SOFT_BG};border:1px solid ${DIVIDER};">
        <tr><td style="padding:14px 16px;font-family:${FONT};">
          <div style="font-size:11px;line-height:15px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${TEXT_SOFT};">${escapeHtml(item.label)}</div>
          <div style="padding-top:6px;font-size:24px;line-height:30px;font-weight:bold;color:${item.color || NAVY};">${escapeHtml(item.value)}</div>
          <div style="padding-top:4px;font-size:12px;line-height:17px;color:${TEXT_SOFT};">${escapeHtml(item.detail)}</div>
        </td></tr>
      </table>
    </td>`;

  let html = `<tr><td style="padding:8px 18px 0 18px;background-color:${PANEL_BG};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`;
  for (let i = 0; i < items.length; i += 2) {
    html += `<tr>${box(items[i])}${items[i + 1] ? box(items[i + 1]) : '<td width="50%"></td>'}</tr>`;
  }
  return `${html}</table></td></tr>`;
}

/** Barra proporcional con una celda coloreada: sin imágenes ni CSS frágil. */
function bar(count, max) {
  const pct = max > 0 ? Math.round((count * 100) / max) : 0;
  if (pct === 0) {
    return `<span style="color:${TEXT_SOFT};">&mdash;</span>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td width="${pct}%" style="background-color:${TERRACOTTA};font-size:0;line-height:4px;height:8px;">&nbsp;</td>
    <td style="font-size:0;line-height:4px;">&nbsp;</td>
  </tr></table>`;
}

/* ------------------------------------------------------------------ *
 * Render HTML
 * ------------------------------------------------------------------ */

export function renderWeeklyReportHtml(model, { mode, generatedAt, salutation }) {
  const isTest = mode !== "production";
  const change = model.change;

  // Además del color, una palabra: el brief pide que el signo no dependa solo
  // del color, tanto por accesibilidad como porque hay clientes que lo alteran.
  const changeColor = change.kind === "up" ? POSITIVE : change.kind === "down" ? NEGATIVE : TEXT_SOFT;
  const changeWord = change.kind === "up" ? "Up" : change.kind === "down" ? "Down" : change.kind === "new" ? "New" : "Flat";

  const kpis = [
    {
      label: "Total Leads",
      value: String(model.total),
      detail: `${model.window.periodShort} (Miami time)`
    },
    {
      label: "Weekly Change",
      value: change.label,
      color: changeColor,
      detail: `${changeWord} from ${plural(model.previousCount, "lead", "leads")} the previous week`
    },
    {
      label: "Top Project Type",
      value: model.topProject ? model.topProject.label : "None",
      detail: model.topProject ? `${plural(model.topProject.count, "lead", "leads")} (${model.topProject.share}%)` : "No leads recorded"
    },
    {
      label: "Top Acquisition Source",
      value: model.topSource ? model.topSource.label : "None recorded",
      detail: model.topSource
        ? `${plural(model.topSource.count, "lead", "leads")} (${model.topSource.share}%)`
        : "No campaign attribution captured"
    }
  ];

  if (model.topLocation) {
    kpis.push({
      label: "Top Location",
      value: model.topLocation.label,
      detail: `${plural(model.topLocation.count, "lead", "leads")} (${model.topLocation.share}%)`
    });
  }

  const testBanner = isTest
    ? `<tr><td style="padding:12px 24px;background-color:${TERRACOTTA};font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;color:${WHITE};">
         TEST REPORT — Generated from non-production sample data. Not for distribution.
       </td></tr>`
    : "";

  const directoryRows = model.directory.map((lead) => [
    escapeHtml(formatMiamiDateTime(lead.createdAt)),
    `${escapeHtml(lead.name)}<br><span style="color:${TEXT_SOFT};font-size:12px;">ID ${escapeHtml(lead.id)}</span>`,
    `${link(safeMailto(lead.email), lead.email || "Not provided")}<br>${link(safeTel(lead.phone), lead.phone || "Not provided")}`,
    escapeHtml(lead.projectLabel),
    escapeHtml(lead.campaign || lead.source || "Direct / Unattributed")
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Droneitor Weekly Lead Report</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};color:${TEXT};">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};">
${escapeHtml(model.insight)}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAGE_BG};">
<tr><td align="center" style="padding:24px 12px;background-color:${PAGE_BG};">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${MAX_WIDTH}" style="width:100%;max-width:${MAX_WIDTH}px;background-color:${PANEL_BG};border:1px solid ${DIVIDER};">

  ${testBanner}

  <tr>
    <td style="padding:26px 24px;background-color:${NAVY};font-family:${FONT};">
      <div style="font-size:11px;line-height:15px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${TERRACOTTA};">Droneitor</div>
      <div style="padding-top:6px;font-size:23px;line-height:29px;font-weight:bold;color:${WHITE};">Weekly Lead Report</div>
      <div style="padding-top:8px;font-size:14px;line-height:20px;color:#c7d2de;">${escapeHtml(model.window.periodLong)} &middot; Miami time</div>
      <div style="padding-top:2px;font-size:12px;line-height:17px;color:#9fb0c2;">Generated ${escapeHtml(generatedAt)}</div>
    </td>
  </tr>

  <tr>
    <td style="padding:22px 24px 4px 24px;background-color:${PANEL_BG};font-family:${FONT};font-size:15px;line-height:22px;color:${TEXT};">
      <p style="margin:0 0 12px 0;">${escapeHtml(salutation)},</p>
      <p style="margin:0;">Here is Droneitor's lead performance summary for ${escapeHtml(model.window.periodLong)}. A total of ${escapeHtml(plural(model.total, "lead was", "leads were"))} captured through fly.droneitor.com.</p>
    </td>
  </tr>

  ${kpiGrid(kpis)}

  <tr>
    <td style="padding:16px 24px 4px 24px;background-color:${PANEL_BG};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${SOFT_BG};border-left:4px solid ${TERRACOTTA};">
        <tr><td style="padding:14px 16px;font-family:${FONT};font-size:14px;line-height:21px;color:${TEXT};">
          <strong style="color:${NAVY};">Insight.</strong> ${escapeHtml(model.insight)}
        </td></tr>
      </table>
    </td>
  </tr>

  ${sectionTitle("Leads by project type")}
  ${dataTable(
    ["Project type", "Leads", "Share"],
    model.byProject.map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}

  ${sectionTitle("Campaign performance")}
  ${dataTable(
    ["Source / Medium", "Leads", "Share"],
    model.bySourceMedium.map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}
  ${dataTable(
    ["Campaign", "Leads", "Share"],
    model.byCampaign.map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}
  <tr>
    <td style="padding:4px 24px 8px 24px;background-color:${PANEL_BG};font-family:${FONT};font-size:13px;line-height:19px;color:${TEXT_SOFT};">
      ${escapeHtml(`${model.fullyAttributed.count} of ${model.total} leads (${model.fullyAttributed.share}%) carried source, medium and campaign. ${model.unattributed.count} (${model.unattributed.share}%) arrived with no source recorded — this is missing attribution, not confirmed direct or organic traffic.`)}
    </td>
  </tr>

  ${sectionTitle("Audience and location")}
  ${dataTable(
    ["Language", "Leads", "Share"],
    model.byLanguage.map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}
  ${dataTable(
    ["Device (approximate)", "Leads", "Share"],
    model.byDevice.map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}
  ${dataTable(
    ["Location", "Leads", "Share"],
    model.byLocation.slice(0, 8).map((r) => [escapeHtml(r.label), String(r.count), `${r.share}%`])
  )}

  ${sectionTitle("Daily activity")}
  <tr>
    <td style="padding:0 24px 8px 24px;background-color:${PANEL_BG};">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;">
        <thead><tr>${headCell("Day")}${headCell("Leads", "text-align:right;")}${headCell("", "width:45%;")}</tr></thead>
        <tbody>
        ${DAY_NAMES.map(
          (day, i) => `<tr>
            ${cell(escapeHtml(day))}
            ${cell(String(model.daily.counts[i]), "text-align:right;")}
            ${cell(bar(model.daily.counts[i], model.daily.max), "width:45%;")}
          </tr>`
        ).join("")}
        </tbody>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:4px 24px 8px 24px;background-color:${PANEL_BG};font-family:${FONT};font-size:13px;line-height:19px;color:${TEXT_SOFT};">
      ${escapeHtml(describeBusiest(model))}
    </td>
  </tr>

  ${sectionTitle(`Lead directory (${plural(model.total, "lead", "leads")})`)}
  ${dataTable(["Received (Miami)", "Lead", "Contact", "Project", "Source / Campaign"], directoryRows)}

  <tr>
    <td style="padding:20px 24px 26px 24px;background-color:${NAVY};font-family:${FONT};font-size:12px;line-height:18px;color:#9fb0c2;">
      <div style="color:#c7d2de;">Report generated automatically from the Droneitor lead database.</div>
      <div style="padding-top:4px;">fly.droneitor.com &middot; All times Miami (America/New_York).</div>
      ${isTest ? `<div style="padding-top:8px;color:${WHITE};font-weight:bold;">TEST REPORT — Generated from non-production sample data.</div>` : ""}
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

/** El día más fuerte, o la verdad de que hubo empate. */
function describeBusiest(model) {
  if (model.total === 0) return "No leads were submitted during this period.";
  if (model.daily.busiest) {
    const bucket = model.timeBuckets.busiest ? ` Most submissions arrived between ${model.timeBuckets.busiest}.` : "";
    return `${model.daily.busiest} was the strongest day with ${plural(model.daily.max, "lead", "leads")}.${bucket}`;
  }
  if (model.daily.busiestTied) {
    return `${model.daily.busiestTied.join(", ")} tied as the strongest days with ${plural(model.daily.max, "lead", "leads")} each.`;
  }
  return "";
}

/** Fecha y hora de Miami legibles, para la cabecera y el directorio. */
export function formatMiamiDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString ?? "");

  const parts = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date)) {
    parts[part.type] = part.value;
  }

  return `${parts.month} ${parts.day}, ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

/* ------------------------------------------------------------------ *
 * Render texto plano
 * ------------------------------------------------------------------ */

/**
 * La alternativa multipart. Lleva la MISMA información de negocio que el HTML,
 * no un resumen: un cliente que solo renderiza texto tiene que poder tomar las
 * mismas decisiones, y que las dos partes difieran es además una señal que
 * algunos filtros de spam puntúan mal.
 */
/**
 * Encaja una etiqueta en una columna de ancho fijo.
 *
 * Si no cabe, se recorta CON puntos suspensivos. Cortar en seco deja
 * "brickell-condos-summer-2026-retargetin", que parece el nombre real de la
 * campaña y no un valor truncado — quien lo lee no tiene forma de saber que
 * falta algo. La versión HTML no tiene esta restricción y muestra el nombre
 * completo.
 */
function fit(label, width) {
  const value = String(label);
  return value.length <= width ? value.padEnd(width) : `${value.slice(0, width - 1)}…`;
}

export function renderWeeklyReportText(model, { mode, generatedAt, salutation }) {
  const isTest = mode !== "production";
  const line = "=".repeat(64);
  const thin = "-".repeat(64);
  const out = [];

  if (isTest) {
    out.push("*** TEST REPORT — Generated from non-production sample data. ***", "");
  }

  out.push(
    line,
    "DRONEITOR — WEEKLY LEAD REPORT",
    `${model.window.periodLong} (Miami time)`,
    `Generated ${generatedAt}`,
    line,
    "",
    `${salutation},`,
    "",
    `Here is Droneitor's lead performance summary for ${model.window.periodLong}.`,
    `A total of ${plural(model.total, "lead was", "leads were")} captured through fly.droneitor.com.`,
    "",
    "SUMMARY",
    thin,
    `Total leads          ${model.total}`,
    `Weekly change        ${model.change.label} (previous week: ${model.previousCount})`,
    `Top project type     ${model.topProject ? `${model.topProject.label} (${model.topProject.count})` : "None"}`,
    `Top source           ${model.topSource ? `${model.topSource.label} (${model.topSource.count})` : "None recorded"}`,
    `Top location         ${model.topLocation ? `${model.topLocation.label} (${model.topLocation.count})` : "Unknown"}`,
    "",
    `Insight: ${model.insight}`,
    ""
  );

  const table = (title, rows) => {
    out.push(title.toUpperCase(), thin);
    if (!rows.length) {
      out.push("No data for this period.", "");
      return;
    }
    for (const r of rows) out.push(`${fit(r.label, 38)} ${String(r.count).padStart(5)}  ${String(r.share).padStart(3)}%`);
    out.push("");
  };

  table("Leads by project type", model.byProject);
  table("Source / medium", model.bySourceMedium);
  table("Campaigns", model.byCampaign);

  out.push(
    `${model.fullyAttributed.count} of ${model.total} leads (${model.fullyAttributed.share}%) carried source, medium and campaign.`,
    `${model.unattributed.count} (${model.unattributed.share}%) arrived with no source recorded — missing attribution,`,
    "not confirmed direct or organic traffic.",
    ""
  );

  table("Language", model.byLanguage);
  table("Device (approximate)", model.byDevice);
  table("Top locations", model.byLocation.slice(0, 8));

  out.push("DAILY ACTIVITY", thin);
  DAY_NAMES.forEach((day, i) => {
    const count = model.daily.counts[i];
    const width = model.daily.max > 0 ? Math.round((count * 24) / model.daily.max) : 0;
    out.push(`${day.padEnd(10)} ${String(count).padStart(3)}  ${"#".repeat(width)}`);
  });
  out.push("", describeBusiest(model), "");

  out.push("TIME OF DAY (Miami)", thin);
  TIME_BUCKETS.forEach((label, i) => out.push(`${label.padEnd(20)} ${String(model.timeBuckets.counts[i]).padStart(3)}`));
  out.push("");

  out.push(`LEAD DIRECTORY (${plural(model.total, "lead", "leads")})`, thin);
  if (!model.directory.length) {
    out.push("No leads for this period.", "");
  } else {
    for (const lead of model.directory) {
      out.push(
        `${formatMiamiDateTime(lead.createdAt)}  —  ${lead.name} (ID ${lead.id})`,
        `    ${lead.email || "No email"} | ${lead.phone || "No phone"}`,
        `    ${lead.projectLabel} | ${lead.campaign || lead.source || "Direct / Unattributed"}`,
        ""
      );
    }
  }

  out.push(
    line,
    "Report generated automatically from the Droneitor lead database.",
    "fly.droneitor.com — All times Miami (America/New_York).",
    isTest ? "TEST REPORT — Generated from non-production sample data." : "",
    line
  );

  return out.filter((l) => l !== undefined).join("\n");
}
