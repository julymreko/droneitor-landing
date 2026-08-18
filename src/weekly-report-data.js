/**
 * Consulta, normalización y agregación del reporte semanal de leads.
 *
 * Este módulo no sabe nada de HTML ni de Zeptomail: recibe una ventana, lee D1
 * y devuelve un objeto con todo lo que el reporte necesita mostrar. Separarlo
 * así es lo que permite probar las cuentas sin red y sin plantilla.
 *
 * Nada de lo que sale de acá viene escapado — escapar es responsabilidad de
 * quien renderiza, que es el único que sabe en qué contexto entra cada valor.
 */

import { miamiDayAndBucket } from "./reporting-window.js";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TIME_BUCKETS = [
  "12:00 AM–5:59 AM",
  "6:00 AM–11:59 AM",
  "12:00 PM–5:59 PM",
  "6:00 PM–11:59 PM"
];

const PROJECT_LABELS = {
  "real-estate": "Real Estate",
  events: "Events",
  construction: "Construction",
  other: "Other"
};

const UNATTRIBUTED = "Direct / Unattributed";
const NOT_PROVIDED = "Not provided";
const UNKNOWN = "Unknown";

/* ------------------------------------------------------------------ *
 * Normalización
 * ------------------------------------------------------------------ */

/**
 * Vacío en todas sus formas: null, undefined, "" y "   ".
 * Los tres primeros llegan de D1; el cuarto, de un UTM con espacios que
 * validate.js trunca pero no limpia.
 */
function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

/** Texto listo para mostrar, o `fallback` si no hay nada que mostrar. */
function text(value, fallback) {
  return blank(value) ? fallback : String(value).trim();
}

/**
 * Clave de agrupación: minúsculas y sin espacios alrededor, para que "Google",
 * "google" y " GOOGLE " caigan en el mismo cubo. Solo se usa para agrupar; lo
 * que se muestra es la primera variante legible que se vio.
 */
function groupKey(value) {
  return blank(value) ? "" : String(value).trim().toLowerCase();
}

/**
 * Clasificación aproximada de dispositivo. Conservadora a propósito: ante la
 * duda cae en "Other / Unknown" en vez de inventar una categoría.
 *
 * El orden importa. Un iPad manda "Mobile" en su user agent, así que si se
 * comprobara móvil primero ninguna tablet se contaría nunca como tablet.
 */
export function classifyDevice(userAgent) {
  if (blank(userAgent)) return UNKNOWN;
  const ua = String(userAgent).toLowerCase();

  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android|windows phone|blackberry|opera mini/.test(ua)) return "Mobile";
  if (/windows nt|macintosh|mac os x|x11|linux|cros/.test(ua)) return "Desktop";
  return "Other";
}

/** Etiqueta legible de un project_type, preservando valores inesperados. */
export function projectLabel(value) {
  if (blank(value)) return UNKNOWN;
  const raw = String(value).trim();
  const known = PROJECT_LABELS[raw.toLowerCase()];
  if (known) return known;

  // Un slug que no conocemos no se descarta: se hace legible y se muestra.
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Miami, FL, US" saltándose las partes vacías, nunca "null, null, Miami". */
export function locationLabel(lead) {
  const parts = [lead.city, lead.region, lead.country].filter((p) => !blank(p)).map((p) => String(p).trim());
  return parts.length ? parts.join(", ") : UNKNOWN;
}

/** Una fila cruda de D1 pasada a los campos que el reporte consume. */
export function normalizeLead(row) {
  const timing = miamiDayAndBucket(row.created_at);

  return {
    id: row.id,
    name: text(row.name, NOT_PROVIDED),
    email: text(row.email, ""),
    phone: text(row.phone, ""),
    createdAt: row.created_at,
    projectLabel: projectLabel(row.project_type),
    lang: groupKey(row.lang),
    source: text(row.utm_source, ""),
    medium: text(row.utm_medium, ""),
    campaign: text(row.utm_campaign, ""),
    content: text(row.utm_content, ""),
    term: text(row.utm_term, ""),
    location: locationLabel(row),
    device: classifyDevice(row.user_agent),
    dayIndex: timing ? timing.dayIndex : null,
    bucket: timing ? timing.bucket : null
  };
}

/* ------------------------------------------------------------------ *
 * Porcentajes
 * ------------------------------------------------------------------ */

/**
 * Reparte porcentajes con el método del resto mayor, de modo que la columna
 * sume exactamente 100 cuando hay algo que repartir.
 *
 * Redondear cada parte por su cuenta produce tablas que suman 99 o 101, que en
 * un reporte ejecutivo se lee como un error de cálculo aunque no lo sea.
 */
export function distributePercentages(counts) {
  const total = counts.reduce((a, n) => a + n, 0);
  if (total === 0) return counts.map(() => 0);

  const exact = counts.map((n) => (n * 100) / total);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((a, n) => a + n, 0);

  // Se reparte el sobrante entre las mayores partes fraccionarias. Los empates
  // se rompen por índice para que dos corridas den siempre lo mismo.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const result = floors.slice();
  for (let i = 0; i < order.length && remainder > 0; i++, remainder--) {
    result[order[i].index] += 1;
  }
  return result;
}

/** Porcentaje suelto, para métricas que no forman parte de una tabla. */
export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part * 100) / total);
}

/* ------------------------------------------------------------------ *
 * Agregación
 * ------------------------------------------------------------------ */

/**
 * Cuenta por clave preservando una etiqueta legible y devolviendo la tabla
 * ordenada por conteo descendente, con desempate alfabético para que el orden
 * sea determinista entre corridas.
 */
function tally(items, keyOf, labelOf) {
  const buckets = new Map();

  for (const item of items) {
    const key = keyOf(item);
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { key, label: labelOf(item), count: 1 });
  }

  const rows = [...buckets.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const shares = distributePercentages(rows.map((r) => r.count));
  return rows.map((row, i) => ({ ...row, share: shares[i] }));
}

/** El cambio semanal, con las tres reglas del brief para el caso degenerado. */
export function weeklyChange(current, previous) {
  if (previous === 0 && current === 0) return { kind: "none", label: "No change", previous };
  if (previous === 0) return { kind: "new", label: "New", previous };

  const delta = Math.round(((current - previous) * 100) / previous);
  if (delta === 0) return { kind: "none", label: "No change", previous };

  return {
    kind: delta > 0 ? "up" : "down",
    // Se evita el -0 y se explicita el signo: "+20%" / "−15%".
    label: `${delta > 0 ? "+" : "−"}${Math.abs(delta)}%`,
    delta,
    previous
  };
}

/** Agrupa por día de la semana, siempre los siete, aunque haya ceros. */
function dailyActivity(leads) {
  const counts = DAY_NAMES.map(() => 0);
  for (const lead of leads) {
    if (lead.dayIndex !== null) counts[lead.dayIndex] += 1;
  }

  const max = Math.max(...counts);
  const busiest = counts.map((n, i) => (n === max ? i : -1)).filter((i) => i !== -1);

  return {
    counts,
    max,
    // Con todo en cero no hay "día más fuerte" que declarar; con empate se dice
    // que lo hubo en vez de elegir uno y afirmar algo que los datos no sostienen.
    busiest: max === 0 ? null : busiest.length === 1 ? DAY_NAMES[busiest[0]] : null,
    busiestTied: max > 0 && busiest.length > 1 ? busiest.map((i) => DAY_NAMES[i]) : null
  };
}

/**
 * Construye todo el modelo del reporte. `leads` son filas crudas de D1.
 */
export function aggregate({ leads, window, previousCount }) {
  const normalized = leads.map(normalizeLead);
  const total = normalized.length;

  const byProject = tally(normalized, (l) => l.projectLabel.toLowerCase(), (l) => l.projectLabel);

  // Fuente/medio se agrupan juntos porque es como se lee la adquisición; el
  // par vacío es tráfico sin atribuir, que no es lo mismo que orgánico.
  //
  // La etiqueta tiene que distinguir TODO lo que distingue la clave. Cuando solo
  // miraba la fuente, un lead sin nada y otro con medium=referral pero sin
  // fuente caían en cubos distintos y se rotulaban los dos "Direct /
  // Unattributed": dos filas idénticas con cifras distintas, que en un reporte
  // ejecutivo se lee como un error de suma.
  const bySourceMedium = tally(
    normalized,
    (l) => `${groupKey(l.source)}|${groupKey(l.medium)}`,
    (l) => {
      if (l.source) return l.medium ? `${l.source} / ${l.medium}` : l.source;
      return l.medium ? `Unattributed / ${l.medium}` : UNATTRIBUTED;
    }
  );

  const byCampaign = tally(
    normalized,
    (l) => groupKey(l.campaign),
    (l) => (l.campaign ? l.campaign : NOT_PROVIDED)
  );

  const bySource = tally(
    normalized,
    (l) => groupKey(l.source),
    (l) => (l.source ? l.source : UNATTRIBUTED)
  );

  const unattributed = normalized.filter((l) => !l.source).length;
  const fullyAttributed = normalized.filter((l) => l.source && l.medium && l.campaign).length;

  const byLanguage = tally(
    normalized,
    (l) => (l.lang === "en" || l.lang === "es" ? l.lang : "unknown"),
    (l) => (l.lang === "en" ? "English" : l.lang === "es" ? "Spanish" : UNKNOWN)
  );

  const byDevice = tally(normalized, (l) => l.device, (l) => (l.device === UNKNOWN ? "Other / Unknown" : l.device));
  const byLocation = tally(normalized, (l) => l.location.toLowerCase(), (l) => l.location);

  const buckets = TIME_BUCKETS.map(() => 0);
  for (const lead of normalized) {
    if (lead.bucket !== null) buckets[lead.bucket] += 1;
  }
  const busiestBucketCount = Math.max(...buckets);
  const busiestBucketIndexes = buckets
    .map((n, i) => (n === busiestBucketCount ? i : -1))
    .filter((i) => i !== -1);

  const change = weeklyChange(total, previousCount);

  // El topX de una tabla vacía es null, no la fila cero: quien renderiza decide
  // qué decir, en vez de recibir "undefined (0)".
  const top = (rows) => (rows.length && rows[0].count > 0 ? rows[0] : null);

  const model = {
    window,
    total,
    previousCount,
    change,
    byProject,
    bySourceMedium,
    byCampaign,
    bySource,
    topProject: top(byProject),
    // El cubo sin atribuir se excluye de los "top": no es una fuente de
    // adquisición, y anunciarlo como la que más leads generó convierte un hueco
    // de medición en un hallazgo de negocio. Cuando no queda ninguna fuente
    // real, esto es null y el renderer lo dice.
    topSource: top(bySource.filter((r) => r.label !== UNATTRIBUTED)),
    topCampaign: top(byCampaign.filter((r) => r.label !== NOT_PROVIDED)),
    topLocation: top(byLocation.filter((r) => r.label !== UNKNOWN)),
    unattributed: { count: unattributed, share: percent(unattributed, total) },
    fullyAttributed: { count: fullyAttributed, share: percent(fullyAttributed, total) },
    byLanguage,
    byDevice,
    byLocation,
    daily: dailyActivity(normalized),
    timeBuckets: {
      counts: buckets,
      busiest: busiestBucketCount === 0 || busiestBucketIndexes.length !== 1 ? null : TIME_BUCKETS[busiestBucketIndexes[0]]
    },
    // Más reciente primero: es una lista de seguimiento, no un histórico.
    directory: [...normalized].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  };

  model.insight = buildInsight(model);
  return model;
}

/**
 * Una frase ejecutiva derivada de los agregados. Determinista a propósito: el
 * brief pide explícitamente no llamar a un LLM en tiempo de ejecución, y además
 * un reporte que se manda solo no puede depender de una API que puede caerse.
 */
export function buildInsight(model) {
  const parts = [];

  if (model.total === 0) return "No leads were captured during this period.";

  if (model.change.kind === "up") {
    parts.push(`Lead volume increased ${model.change.label.replace("+", "")} week over week`);
  } else if (model.change.kind === "down") {
    parts.push(`Lead volume decreased ${model.change.label.replace("−", "")} week over week`);
  } else if (model.change.kind === "new") {
    parts.push(`This is the first week with leads after a week with none`);
  } else {
    parts.push(`Lead volume held steady week over week`);
  }

  if (model.topProject) {
    parts.push(`${model.topProject.label} was the leading service`);
  }

  if (model.topSource) {
    parts.push(`${model.topSource.label} generated the most leads`);
  } else if (model.unattributed.count === model.total) {
    parts.push(`no campaign attribution was recorded`);
  }

  // Se arma como oración y no como lista para que lea a resumen ejecutivo.
  const last = parts.pop();
  return parts.length ? `${parts.join(", ")}, and ${last}.` : `${last}.`;
}

/* ------------------------------------------------------------------ *
 * Acceso a D1
 * ------------------------------------------------------------------ */

/**
 * Los leads de una ventana, más reciente primero.
 *
 * El intervalo es semiabierto y compara strings ISO-8601, que en UTC con
 * `toISOString()` ordenan igual que cronológicamente. Usa idx_leads_created_at,
 * que ya existe desde la migración 0001.
 */
export async function fetchLeads(env, window) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, project_type, lang,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            country, region, city, user_agent, created_at
       FROM leads
      WHERE created_at >= ? AND created_at < ?
      ORDER BY created_at DESC`
  )
    .bind(window.startUtc, window.endUtc)
    .all();

  return results || [];
}

/** Solo el conteo, para el comparativo con la semana anterior. */
export async function countLeads(env, window) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM leads WHERE created_at >= ? AND created_at < ?"
  )
    .bind(window.startUtc, window.endUtc)
    .first();

  return row?.n ?? 0;
}
