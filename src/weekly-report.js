/**
 * Reporte semanal de leads: orquestación y envío.
 *
 * Junta las piezas — ventana, datos, render, destinatarios, Zeptomail y
 * registro de entrega — y es lo único que el handler `scheduled` necesita
 * llamar. Cada pieza vive en su módulo para poder probarla suelta; acá solo
 * está el orden y las decisiones de "mandar o no mandar".
 *
 * Es un correo INTERNO para Droneitor y 2DM. No tiene nada que ver con el
 * correo de bienvenida del lead ni con el aviso de lead nuevo, y no debe
 * reutilizar sus destinatarios ni su remitente.
 */

import { lastCompletedWeek, previousWeek } from "./reporting-window.js";
import { aggregate, countLeads, fetchLeads } from "./weekly-report-data.js";
import { buildSubject, formatMiamiDateTime, renderWeeklyReportHtml, renderWeeklyReportText } from "./weekly-report-template.js";

const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";
const REPORT_TYPE = "weekly-lead-report";

// Remitente propio, distinto del no-reply que usan los correos al lead: este
// sale del buzón que las dos personas que lo reciben pueden contestar.
const DEFAULT_FROM_EMAIL = "support@droneitor.com";
const DEFAULT_FROM_NAME = "Droneitor Reports";

/**
 * Modo de ejecución.
 *
 * Todo lo que no sea exactamente "production" es modo test. Un typo en la
 * variable, una var sin definir o un valor heredado de otro entorno tienen que
 * caer del lado que no le escribe al cliente — nunca al revés.
 */
export function resolveMode(env) {
  return String(env.REPORT_MODE ?? "").trim().toLowerCase() === "production" ? "production" : "test";
}

/**
 * Parsea una lista de destinatarios.
 *
 * Acepta "Nombre <correo@dominio>" y "correo@dominio", separados por coma. Las
 * entradas sin forma de dirección se descartan en vez de mandarse: una lista
 * mal escrita debe reducir destinatarios, no hacer fallar el envío entero ni
 * colar una dirección basura.
 */
export function parseRecipients(raw) {
  return String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const angled = entry.match(/^(.*?)\s*<([^>]+)>$/);
      const name = angled ? angled[1].trim() : "";
      const address = (angled ? angled[2] : entry).trim();
      return { address, name: name || address.split("@")[0] };
    })
    .filter((r) => /^[^\s@,<>]+@[^\s@,<>.]+\.[^\s@,<>]+$/.test(r.address));
}

/** Los destinatarios que corresponden al modo, ya validados. */
export function resolveRecipients(env, mode) {
  const raw = mode === "production" ? env.WEEKLY_REPORT_PRODUCTION_RECIPIENTS : env.WEEKLY_REPORT_TEST_RECIPIENTS;
  return parseRecipients(raw);
}

/** Direcciones enmascaradas para el log: ni la lista completa ni nada en claro. */
export const maskAddress = (address) => {
  const [user, domain] = String(address).split("@");
  if (!domain) return "***";
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

/**
 * Genera el reporte de una ventana sin mandarlo ni tocar la tabla de entregas.
 *
 * Es lo que usan el dry-run, la vista previa local y los tests. Que exista
 * separado del envío es lo que permite mirar el reporte sin efectos externos.
 */
export async function buildWeeklyReport(env, { now = new Date(), mode = resolveMode(env) } = {}) {
  const window = lastCompletedWeek(now);
  const prior = previousWeek(window);

  const [leads, previousCount] = await Promise.all([fetchLeads(env, window), countLeads(env, prior)]);

  const model = aggregate({ leads, window, previousCount });
  const recipients = resolveRecipients(env, mode);

  const context = {
    mode,
    generatedAt: `${formatMiamiDateTime(now.toISOString())} (Miami time)`,
    // El saludo depende de a quién le llega de verdad, no del modo: si mañana
    // se añade un destinatario, el encabezado no se queda mintiendo.
    salutation: salutationFor(recipients)
  };

  return {
    mode,
    window,
    model,
    recipients,
    subject: buildSubject(model, context),
    html: renderWeeklyReportHtml(model, context),
    text: renderWeeklyReportText(model, context)
  };
}

function salutationFor(recipients) {
  const names = recipients.map((r) => r.name.split(/[\s.]+/)[0]).filter(Boolean);
  if (names.length === 0) return "Hello";
  if (names.length === 1) return capitalize(names[0]);
  return `${names.slice(0, -1).map(capitalize).join(", ")} and ${capitalize(names[names.length - 1])}`;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ *
 * Idempotencia
 * ------------------------------------------------------------------ */

/**
 * Reclama el periodo antes de mandar nada.
 *
 * El INSERT choca contra el UNIQUE (report_type, period_key, mode) si ya hay
 * fila, así que la exclusión la garantiza la base y no una comprobación previa
 * en JavaScript, que dejaría una ventana entre el SELECT y el INSERT por la que
 * dos invocaciones pasarían las dos.
 *
 * Devuelve `{ claimed: false, existing }` si el periodo ya está tomado.
 */
async function claimPeriod(env, { window, mode, leadCount, recipientCount, now }) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO report_deliveries
       (report_type, period_key, period_start, period_end, mode, lead_count, recipient_count, status, claimed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(REPORT_TYPE, window.periodKey, window.startUtc, window.endUtc, mode, leadCount, recipientCount, now.toISOString())
    .run();

  if (result.meta?.changes > 0) return { claimed: true };

  const existing = await env.DB.prepare(
    "SELECT status, sent_at FROM report_deliveries WHERE report_type = ? AND period_key = ? AND mode = ?"
  )
    .bind(REPORT_TYPE, window.periodKey, mode)
    .first();

  return { claimed: false, existing };
}

/** Libera la reclamación para que un reintento pueda volver a tomarla. */
async function releasePeriod(env, window, mode) {
  await env.DB.prepare(
    "DELETE FROM report_deliveries WHERE report_type = ? AND period_key = ? AND mode = ? AND status = 'pending'"
  )
    .bind(REPORT_TYPE, window.periodKey, mode)
    .run();
}

/** Marca la entrega como hecha. Solo se llama con un 2xx de Zeptomail en mano. */
async function markSent(env, window, mode, messageId, now) {
  await env.DB.prepare(
    "UPDATE report_deliveries SET status = 'sent', message_id = ?, sent_at = ? WHERE report_type = ? AND period_key = ? AND mode = ?"
  )
    .bind(messageId ?? null, now.toISOString(), REPORT_TYPE, window.periodKey, mode)
    .run();
}

/* ------------------------------------------------------------------ *
 * Envío
 * ------------------------------------------------------------------ */

/** El payload tal cual lo espera Zeptomail. Separado para poder probarlo sin red. */
export function buildReportPayload(env, report) {
  return {
    from: {
      address: env.REPORT_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      name: env.REPORT_FROM_NAME || DEFAULT_FROM_NAME
    },
    to: report.recipients.map((r) => ({ email_address: { address: r.address, name: r.name } })),
    subject: report.subject,
    textbody: report.text,
    htmlbody: report.html
  };
}

/**
 * El token del Mail Agent que manda el reporte.
 *
 * En Zeptomail cada Mail Agent tiene su propio Send Mail Token, y el remitente
 * tiene que pertenecer al agente cuyo token firma la petición. El reporte sale
 * de support@droneitor.com, que está en un agente distinto del que manda
 * no-reply@ a los leads — con la clave equivocada la API responde 401.
 *
 * La reserva a ZEPTOMAIL_API_KEY existe para no romper nada si los dos
 * remitentes acaban en el mismo agente; en cuanto se ponga el secreto propio,
 * manda ese.
 */
const reportApiKey = (env) => env.REPORT_ZEPTOMAIL_API_KEY || env.ZEPTOMAIL_API_KEY;

/**
 * Manda el reporte. Lanza si Zeptomail no acepta.
 *
 * No reintenta acá dentro: quien decide reintentar es el cron, y hacerlo en
 * bucle dentro de la misma invocación se llevaría por delante la coordinación
 * con la reclamación del periodo.
 */
async function sendReport(env, report) {
  const res = await fetch(ZEPTOMAIL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Zoho-enczapikey ${reportApiKey(env)}`
    },
    body: JSON.stringify(buildReportPayload(env, report))
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Zeptomail rechazó el reporte semanal (${res.status}): ${body}`);
  }

  // El request_id sirve para rastrear la entrega en el panel. Si la respuesta
  // no es JSON o cambia de forma, no se rompe el envío por no poder leerlo.
  try {
    const parsed = JSON.parse(body);
    return parsed?.request_id ?? parsed?.data?.[0]?.message_id ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Punto de entrada
 * ------------------------------------------------------------------ */

/**
 * Genera y (si procede) envía el reporte de la última semana completa.
 *
 * Devuelve siempre un objeto con `status`, que es lo que se registra en el log
 * estructurado: skipped_no_leads | skipped_already_sent | skipped_no_recipients
 * | dry_run | sent.
 */
export async function runWeeklyReport(env, { now = new Date(), dryRun = false } = {}) {
  const mode = resolveMode(env);
  const report = await buildWeeklyReport(env, { now, mode });
  const { window, model, recipients } = report;

  const base = {
    report: REPORT_TYPE,
    mode,
    period: window.periodKey,
    periodStart: window.startUtc,
    periodEnd: window.endUtc,
    leadCount: model.total,
    recipientCount: recipients.length
  };

  // Semana sin leads: no se manda nada. Un correo que dice "0 leads" cada lunes
  // entrena a los destinatarios a ignorar el reporte.
  if (model.total === 0) {
    console.log(JSON.stringify({ ...base, status: "skipped_no_leads" }));
    return { ...base, status: "skipped_no_leads", report };
  }

  if (recipients.length === 0) {
    console.error(JSON.stringify({ ...base, status: "skipped_no_recipients" }));
    return { ...base, status: "skipped_no_recipients", report };
  }

  // Sin token se comprueba ACÁ y no en el fetch: mandar sin él da un 401 que se
  // lee como "Zeptomail rechazó el reporte" y manda a buscar el problema al
  // remitente o al dominio, cuando lo único que falta es el secreto.
  if (!dryRun && !reportApiKey(env)) {
    console.error(JSON.stringify({ ...base, status: "skipped_no_api_key" }));
    return { ...base, status: "skipped_no_api_key", report };
  }

  if (dryRun) {
    console.log(JSON.stringify({ ...base, status: "dry_run" }));
    return { ...base, status: "dry_run", report };
  }

  const claim = await claimPeriod(env, {
    window,
    mode,
    leadCount: model.total,
    recipientCount: recipients.length,
    now
  });

  if (!claim.claimed) {
    const status = claim.existing?.status === "sent" ? "skipped_already_sent" : "skipped_claim_in_flight";
    console.log(JSON.stringify({ ...base, status, previouslySentAt: claim.existing?.sent_at ?? null }));
    return { ...base, status, report };
  }

  let messageId;
  try {
    messageId = await sendReport(env, report);
  } catch (err) {
    // La reclamación se libera para que el próximo intento pueda tomarla. Sin
    // esto un 503 pasajero de Zeptomail dejaría la semana bloqueada para siempre.
    await releasePeriod(env, window, mode);
    console.error(JSON.stringify({ ...base, status: "send_failed", error: String(err.message || err) }));
    throw err;
  }

  await markSent(env, window, mode, messageId, now);

  console.log(
    JSON.stringify({
      ...base,
      status: "sent",
      messageId: messageId ?? null,
      // Enmascarados: el log no es sitio para una lista de correos.
      recipients: recipients.map((r) => maskAddress(r.address))
    })
  );

  return { ...base, status: "sent", messageId, report };
}
