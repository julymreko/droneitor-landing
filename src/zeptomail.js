/**
 * Correo de bienvenida vía Zeptomail (API transaccional de Zoho).
 *
 * Mismo patrón que sheets.js: un fetch directo, sin SDK — Zeptomail expone
 * una API REST simple y no vale la pena una dependencia sólo por esto.
 * https://api.zeptomail.com/v1.1/email — se manda `htmlbody` con el wordmark
 * embebido como imagen inline y referenciado por Content-ID desde la plantilla.
 *
 * Tanto la plantilla como el logo llegan como strings desde módulos generados
 * (scripts/build-email-assets.mjs) y no se leen de disco: esto corre en
 * Workers, que no tiene filesystem en tiempo de ejecución.
 */

import { LOGO_BASE64 } from "./logo-base64.js";
import { HTML_HEAD, HTML_ES, HTML_FOOT } from "./email-template.js";

const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";

// Confirmado con el cliente.
const SUBJECT = "Your 10% Droneitor discount is ready";

// Tiene que coincidir con el <img src="cid:droneitor-wordmark"> de la plantilla.
const LOGO_CID = "droneitor-wordmark";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/**
 * El nombre se interpola dentro de HTML, así que se escapa acá. Hoy validate.js
 * ya prohíbe `<`, `>` y `&` en el nombre, pero esto no debe depender de eso:
 * si alguna vez se afloja NAME_RE, el correo no se convierte en un vector de
 * inyección de markup sin que nadie se entere.
 */
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

/**
 * Inglés siempre; español debajo sólo si lang === "es". `lang` ya viene
 * normalizado a "en"/"es" por validate.js, así que no hace falta revalidarlo.
 *
 * El pie va en ambos idiomas — es bilingüe y además trae los cierres del
 * documento, por eso el corte del español es un tramo del medio y no un
 * truncado hasta el final.
 */
export function buildWelcomeEmailBody(lead) {
  const html = lead.lang === "es" ? HTML_HEAD + HTML_ES + HTML_FOOT : HTML_HEAD + HTML_FOOT;
  return html.replaceAll("{name}", escapeHtml(lead.name));
}

/**
 * Arma el payload tal cual lo espera Zeptomail. Separado de sendWelcomeEmail
 * a propósito, para poder probarlo sin red — igual que leadToRow en
 * sheets.js.
 */
export function buildWelcomeEmailPayload(env, lead) {
  return {
    from: { address: env.ZEPTOMAIL_FROM_EMAIL, name: env.ZEPTOMAIL_FROM_NAME },
    to: [{ email_address: { address: lead.email, name: lead.name } }],
    subject: SUBJECT,
    htmlbody: buildWelcomeEmailBody(lead),
    // Nombres de campo según la API de Zeptomail: `cid` + `content`, y el
    // base64 va crudo (el mime_type viaja en su propio campo, un prefijo
    // `data:image/png;base64,` acá rompe la resolución del cid).
    inline_images: [{ mime_type: "image/png", content: LOGO_BASE64, cid: LOGO_CID }]
  };
}

/** Envía el correo de bienvenida. Lanza si Zeptomail responde error. */
export async function sendWelcomeEmail(env, lead) {
  const res = await fetch(ZEPTOMAIL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Zoho-enczapikey ${env.ZEPTOMAIL_API_KEY}`
    },
    body: JSON.stringify(buildWelcomeEmailPayload(env, lead))
  });

  if (!res.ok) {
    throw new Error(`Zeptomail rechazó el envío (${res.status}): ${await res.text()}`);
  }
}
