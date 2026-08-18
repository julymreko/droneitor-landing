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
const SUBJECT = "Request received! Let's elevate your project";

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

Thank you for reaching out! We've successfully received your information.

Whether you're looking for stunning aerial visuals, dynamic social media content, or custom drone solutions here in Miami and South Florida, our team is ready to bring your vision to life.

We are currently reviewing your details and will get back to you within 24 to 48 hours to discuss the next steps. If you have any immediate questions or additional details to share in the meantime, feel free to reply directly to this email.

Talk soon,
Marco Beas
Droneitor LLC
+1(786) 656-2397 (WhatsApp)
contact@droneitor.com
droneitor.com`;

const esText = ({ name }) => `Hola ${name},

¡Gracias por comunicarte con nosotros! Ya recibimos tu información.

Ya sea que busques visuales aéreos impresionantes, contenido dinámico para redes sociales, o soluciones personalizadas con drones aquí en Miami y el Sur de Florida, nuestro equipo está listo para llevar tu visión a la realidad.

Estamos revisando actualmente tus detalles y nos comunicaremos contigo dentro de 24 a 48 horas para discutir los próximos pasos. Si tienes preguntas inmediatas o detalles adicionales que compartir mientras tanto, no dudes en responder este correo directamente.

Hasta pronto,
Marco Beas
Droneitor LLC
+1 (786) 656-2397 (WhatsApp)
contact@droneitor.com
droneitor.com`;

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
