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

// Texto plano: la alternativa multipart que acompaña al htmlbody, para los
// clientes que no renderizan HTML y para los filtros de spam. Acá no se escapa
// nada: es texto, no markup.
//
// El contenido replica el de la plantilla HTML a propósito. Que las dos partes
// de un multipart digan cosas distintas es en sí una señal que algunos filtros
// puntúan mal, así que si se toca el copy de una hay que tocar el de la otra —
// hay un test que compara las afirmaciones centrales de ambas.
const enText = ({ name }) => `Hi ${name},

Thanks for reaching out to Droneitor. We've received the request you
submitted through fly.droneitor.com.

Your 10% discount is confirmed and active immediately for your next
booking with us. There is nothing else you need to claim or activate.

NEXT STEP
Our team will be in touch shortly to coordinate your project, location,
flight details and timing.

Kind regards,
Team Droneitor

contact@droneitor.com
+1 (786) 656-2397`;

const esText = ({ name }) => `Hola ${name},

Gracias por comunicarte con Droneitor. Recibimos la solicitud que
enviaste a través de fly.droneitor.com.

Tu descuento del 10% está confirmado y activo de inmediato para tu
próxima reservación con nosotros. No necesitas reclamarlo ni realizar
ningún paso adicional.

SIGUIENTE PASO
Nuestro equipo se comunicará contigo muy pronto para coordinar tu
proyecto, ubicación, detalles del vuelo y horario.

Cordialmente,
Team Droneitor

contact@droneitor.com
+1 (786) 656-2397`;

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

/** La alternativa en texto plano del mismo correo, con la misma regla de idioma. */
export function buildWelcomeEmailText(lead) {
  const text = enText(lead);
  return lead.lang === "es" ? `${text}\n\n---\n\n${esText(lead)}` : text;
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
    // Los dos juntos: Zeptomail los acepta a la vez y arma un multipart. El
    // cliente que renderiza HTML muestra el HTML; el que no, y los filtros de
    // spam, se quedan con el texto.
    textbody: buildWelcomeEmailText(lead),
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
