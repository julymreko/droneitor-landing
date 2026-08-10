/**
 * Correo de bienvenida vía Zeptomail (API transaccional de Zoho).
 *
 * Mismo patrón que sheets.js: un fetch directo, sin SDK — Zeptomail expone
 * una API REST simple y no vale la pena una dependencia sólo por esto.
 * https://api.zeptomail.com/v1.1/email — sólo texto plano, nunca HTML: se
 * manda `textbody` y nunca `htmlbody`.
 */

const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";

// Confirmado con el cliente.
const SUBJECT = "Your 10% Droneitor discount is ready";

const enBody = ({ name }) => `Hi ${name},

Thanks for reaching out — we've received your request. Your 10%
discount is ready for your first flight with us, and we'll be in touch
shortly to coordinate the details.

Best regards,
The Droneitor Team`;

const esBody = ({ name }) => `Hola ${name},

Gracias por tu interés — ya recibimos tu solicitud. Tu 10% de
descuento está listo para tu primer vuelo con nosotros, y te
contactaremos pronto para coordinar los detalles.

Saludos cordiales,
El equipo de Droneitor`;

/**
 * Inglés siempre primero; español debajo sólo si lang === "es". `lang` ya
 * viene normalizado a "en"/"es" por validate.js, así que no hace falta
 * volver a validarlo acá.
 */
export function buildWelcomeEmailBody(lead) {
  const body = enBody(lead);
  return lead.lang === "es" ? `${body}\n\n---\n\n${esBody(lead)}` : body;
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
    textbody: buildWelcomeEmailBody(lead)
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
