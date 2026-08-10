/**
 * Worker de la landing de Droneitor.
 *
 * Es un Worker híbrido: Cloudflare sirve primero cualquier fichero estático de
 * `public/` y sólo invoca este script cuando la ruta no corresponde a un
 * fichero — o sea, en la práctica, sólo para POST /api/lead. Por eso no hacen
 * falta patrones de ruta ni el binding ASSETS.
 */

import { validateLead } from "./validate.js";
import { verifyTurnstile } from "./turnstile.js";
import { appendLead } from "./sheets.js";
import { sendWelcomeEmail } from "./zeptomail.js";

const MAX_BODY_BYTES = 8 * 1024;

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lead") {
      return handleLead(request, env, ctx);
    }

    // Cualquier otra cosa que llegue hasta aquí no es un asset conocido.
    return new Response("Not found", { status: 404 });
  }
};

async function handleLead(request, env, ctx) {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return json(415, { ok: false, error: "unsupported_media_type" });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, errors: ["body"] });
  }

  const validation = validateLead(parsed);
  if (!validation.ok) {
    return json(400, { ok: false, errors: validation.errors });
  }
  const lead = validation.value;

  const ip = request.headers.get("CF-Connecting-IP");

  // Turnstile se verifica ANTES del insert: un reto fallido no debe dejar fila.
  const turnstile = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET_KEY,
    token: lead.turnstileToken,
    ip
  });

  if (!turnstile.success) {
    console.warn("Turnstile rechazó el envío:", turnstile.errorCodes.join(", "));
    return json(403, { ok: false, errors: ["captcha"] });
  }

  // request.cf trae la geo que Cloudflare ya resolvió en el edge.
  // En `wrangler dev` local puede venir incompleta: se guarda lo que haya.
  const cf = request.cf || {};
  const row = {
    ...lead,
    country: cf.country ?? null,
    region: cf.region ?? null,
    city: cf.city ?? null,
    ip,
    user_agent: request.headers.get("user-agent"),
    ts_success: 1,
    ts_challenge_ts: turnstile.challenge_ts,
    ts_hostname: turnstile.hostname,
    ts_action: turnstile.action,
    ts_cdata: turnstile.cdata,
    created_at: new Date().toISOString()
  };

  let leadId;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO leads (
         name, email, phone, project_type, lang, consent,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         country, region, city, ip, user_agent,
         ts_success, ts_challenge_ts, ts_hostname, ts_action, ts_cdata,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.name, row.email, row.phone, row.project_type, row.lang, row.consent,
      row.utm_source, row.utm_medium, row.utm_campaign, row.utm_content, row.utm_term,
      row.country, row.region, row.city, row.ip, row.user_agent,
      row.ts_success, row.ts_challenge_ts, row.ts_hostname, row.ts_action, row.ts_cdata,
      row.created_at
    ).run();

    leadId = result.meta?.last_row_id;
  } catch (err) {
    // D1 es la fuente de verdad: si esto falla, el lead NO está guardado y
    // hay que decírselo al visitante para que reintente.
    console.error("Insert en D1 falló:", err);
    return json(500, { ok: false, error: "storage_failed" });
  }

  // A partir de aquí el lead ya está a salvo. La réplica a Sheets y el
  // correo de bienvenida son best-effort e independientes entre sí: van
  // después de responder, y ninguno espera al otro. Una caída de Google no
  // puede mostrarle un error a alguien que llegó por un anuncio pagado, y una
  // caída de Zeptomail tampoco puede costarle el correo a un lead que sí se
  // guardó — encadenar el correo detrás de Sheets reintroduciría exactamente
  // ese fallo silencioso.
  const leadWithId = { ...row, id: leadId };
  ctx.waitUntil(syncToSheets(env, leadWithId));
  ctx.waitUntil(sendWelcomeEmailSafely(env, leadWithId));

  return json(200, { ok: true });
}

async function syncToSheets(env, lead) {
  try {
    await appendLead(env, lead);
    await env.DB.prepare("UPDATE leads SET synced_to_sheets = 1 WHERE id = ?")
      .bind(lead.id)
      .run();
  } catch (err) {
    // Queda en la tabla con synced_to_sheets = 0 para poder rellenarlo luego.
    console.error(`Réplica a Sheets falló para el lead ${lead.id}: ${err.message}`);
  }
}

async function sendWelcomeEmailSafely(env, lead) {
  try {
    await sendWelcomeEmail(env, lead);
    await env.DB.prepare("UPDATE leads SET email_sent = 1 WHERE id = ?")
      .bind(lead.id)
      .run();
  } catch (err) {
    // Igual que Sheets: el lead ya está a salvo en D1, así que esto nunca
    // llega al visitante. Queda email_sent = 0 para poder ver y reintentar
    // los envíos fallidos sin tener que rastrear logs de Workers.
    console.error(`Correo de bienvenida falló para el lead ${lead.id}: ${err.message}`);
  }
}
