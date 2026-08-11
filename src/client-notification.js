/**
 * Aviso interno de lead nuevo vía Zeptomail.
 *
 * Mismo patrón que zeptomail.js: buildX() separado de sendX() para poder
 * probar el payload sin red. Va a Marco (TO) con Julian en copia, siempre en
 * inglés, independientemente del idioma que eligió el lead.
 */

import { LOGO_BASE64_2DM } from "./logo-2dm-base64.js";
import { SUBJECT_2DM, HTML_HEAD_2DM, HTML_EN_2DM, HTML_FOOT_2DM, TEXT_EN_2DM } from "./client-notification-template.js";

const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";

// Destinatarios fijos: en fase 1 son siempre los mismos dos y no hay caso de
// uso para cambiarlos sin volver a desplegar. Si alguna vez hay que rotarlos
// sin deploy, pasan a vars de wrangler.jsonc.
const CLIENT_EMAIL = "droneitor1983@gmail.com";
const CLIENT_NAME = "Marco Beas";
const ADMIN_EMAIL = "cj.cely@hotmail.com";
const ADMIN_NAME = "Julian Cely";

// El nombre del remitente es el de 2DM a propósito — este correo lo manda la
// agencia, no la marca del cliente. La dirección sí sale de la env var: el
// dominio tiene que estar verificado en Zeptomail y esa verificación se
// gestiona en un solo sitio (wrangler.jsonc).
const FROM_NAME = "Tu Digital Marketing";

// Tiene que coincidir con el <img src="cid:2dm-logo"> de la plantilla.
const LOGO_CID = "2dm-logo";

// El user agent completo no aporta nada en un correo y descuadra la tabla.
const USER_AGENT_MAX = 100;

const EMPTY_DISPLAY = "—";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

/** Formatea un ISO-8601 UTC a hora de Miami legible. */
export function formatLeadTimestamp(isoString) {
  try {
    const date = new Date(isoString);
    // Miami es Eastern, no Central: America/Chicago dejaba todos los avisos
    // una hora antes de la hora que el propio correo dice ser.
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    const hour = parts.find(p => p.type === "hour")?.value;
    const minute = parts.find(p => p.type === "minute")?.value;
    const period = parts.find(p => p.type === "dayPeriod")?.value || "AM";
    return `${year}-${month}-${day} at ${hour}:${minute} ${period}`;
  } catch (err) {
    console.error(`Formateo de la fecha del lead falló: ${err.stack || err.message}`);
    return isoString;
  }
}

/** Vacío/nulo → em dash, para que la celda no quede en blanco sin explicación. */
function normalizeFieldForDisplay(value) {
  if (value === null || value === undefined || value === "") return EMPTY_DISPLAY;
  const s = String(value).trim();
  return s === "" ? EMPTY_DISPLAY : s;
}

/**
 * Los valores que interpola la plantilla, resueltos una sola vez para las dos
 * partes del multipart — así el HTML y el texto no pueden discrepar, y la
 * fecha se formatea una vez en vez de dos.
 */
function leadFields(lead) {
  const userAgent = lead.user_agent ? String(lead.user_agent).slice(0, USER_AGENT_MAX) : "";

  return {
    lead_id: normalizeFieldForDisplay(lead.id),
    name: normalizeFieldForDisplay(lead.name),
    email: normalizeFieldForDisplay(lead.email),
    phone: normalizeFieldForDisplay(lead.phone),
    // index.js siempre pone created_at, pero si alguna vez faltara la fila
    // debe decir lo mismo que cualquier otro campo vacío, no quedar en blanco.
    created_at_formatted: normalizeFieldForDisplay(formatLeadTimestamp(lead.created_at || "")),
    project_type: normalizeFieldForDisplay(lead.project_type),
    lang: normalizeFieldForDisplay(lead.lang),
    utm_source: normalizeFieldForDisplay(lead.utm_source),
    utm_medium: normalizeFieldForDisplay(lead.utm_medium),
    utm_campaign: normalizeFieldForDisplay(lead.utm_campaign),
    utm_content: normalizeFieldForDisplay(lead.utm_content),
    utm_term: normalizeFieldForDisplay(lead.utm_term),
    country: normalizeFieldForDisplay(lead.country),
    region: normalizeFieldForDisplay(lead.region),
    city: normalizeFieldForDisplay(lead.city),
    user_agent: normalizeFieldForDisplay(userAgent),
    ip: normalizeFieldForDisplay(lead.ip)
  };
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/**
 * Rellena la plantilla en UNA sola pasada, con un reemplazo por función.
 *
 * Las dos cosas son deliberadas y no son estilo:
 *
 * 1. Función y no string: en `replaceAll(x, str)` el reemplazo interpreta
 *    `$&`, `$'`, `` $` `` y `$$`. Un `?utm_medium=$&` devolvía literalmente el
 *    placeholder al correo. Un reemplazo por función se inserta tal cual.
 * 2. Una pasada y no una cadena de replaceAll: encadenados, cada paso vuelve a
 *    escanear lo que ya escribieron los anteriores, así que un
 *    `?utm_campaign={ip}` acababa mostrando la IP real del visitante en la fila
 *    de la campaña. Lo que devuelve el replacer nunca se re-escanea.
 *
 * `escape` es la identidad para la parte de texto plano: ahí no hay markup.
 */
function renderTemplate(template, fields, escape) {
  return template.replace(PLACEHOLDER_RE, (match, key) =>
    key in fields ? escape(fields[key]) : match
  );
}

/**
 * Arma el payload tal cual lo espera Zeptomail. Separado de
 * sendClientNotification para poder probarlo sin red.
 *
 * Se escapa TODO lo que entra en el HTML, no sólo el nombre: los UTM salen del
 * query string y validate.js sólo los trunca (nunca filtra caracteres), y el
 * user agent es una cabecera cruda. Los dos son texto de quien envía, así que
 * sin escapar cualquiera podía inyectar markup en un correo que Marco y Julian
 * abren — desde un pixel de seguimiento hasta romper la tabla entera.
 */
export function buildClientNotificationPayload(env, lead) {
  const html = HTML_HEAD_2DM + HTML_EN_2DM + HTML_FOOT_2DM;
  const fields = leadFields(lead);

  return {
    from: { address: env.ZEPTOMAIL_FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: CLIENT_EMAIL, name: CLIENT_NAME } }],
    cc: [{ email_address: { address: ADMIN_EMAIL, name: ADMIN_NAME } }],
    subject: SUBJECT_2DM,
    textbody: renderTemplate(TEXT_EN_2DM, fields, (v) => v),
    htmlbody: renderTemplate(html, fields, escapeHtml),
    // Base64 crudo, igual que en zeptomail.js: el prefijo `data:` rompe la
    // resolución del cid.
    inline_images: [{ mime_type: "image/png", content: LOGO_BASE64_2DM, cid: LOGO_CID }]
  };
}

/** Envía el aviso de lead nuevo. Lanza si Zeptomail responde error. */
export async function sendClientNotification(env, lead) {
  const res = await fetch(ZEPTOMAIL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Zoho-enczapikey ${env.ZEPTOMAIL_API_KEY}`
    },
    body: JSON.stringify(buildClientNotificationPayload(env, lead))
  });

  if (!res.ok) {
    throw new Error(`Zeptomail rechazó el aviso de lead (${res.status}): ${await res.text()}`);
  }
}
