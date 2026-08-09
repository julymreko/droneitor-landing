/**
 * Validación de leads en servidor.
 *
 * Módulo puro y sin I/O — no toca D1, ni Turnstile, ni la red — para poder
 * probarlo con vitest sin levantar un Worker.
 *
 * Duplica a propósito las reglas de `public/script.js`: la del cliente existe
 * para dar feedback inmediato, pero cualquiera puede hacer POST directo al
 * endpoint, así que ésta es la que manda.
 */

export const PROJECT_TYPES = ["real-estate", "events", "construction", "other"];
export const LANGS = ["en", "es"];
export const DEFAULT_LANG = "en";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const UTM_MAX = 200;

// Límites deliberadamente generosos: acotan el abuso sin rechazar
// nombres o teléfonos internacionales legítimos.
const NAME_MIN = 2;
const NAME_MAX = 100;
const EMAIL_MAX = 254; // RFC 5321
const PHONE_MAX = 32;
const TOKEN_MAX = 2048;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s\d]+$/;
const PHONE_MIN_DIGITS = 7;

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Los UTM vienen del query string, o sea de fuera. Se truncan en vez de
 * rechazarse: perder un lead pagado porque una campaña traía un parámetro
 * raro sería mucho peor que guardar la atribución recortada.
 */
function cleanUtm(value) {
  const s = str(value);
  return s ? s.slice(0, UTM_MAX) : null;
}

/**
 * @param {unknown} raw Cuerpo JSON ya parseado.
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 *   Las claves de `errors` coinciden con los ids `field-*` del formulario,
 *   para que el cliente pueda marcar los mismos campos en rojo.
 */
export function validateLead(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["body"] };
  }

  const errors = [];

  const name = str(raw.name);
  if (name.length < NAME_MIN || name.length > NAME_MAX) errors.push("name");

  const email = str(raw.email).toLowerCase();
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) errors.push("email");

  const phone = str(raw.phone);
  const digits = (phone.match(/\d/g) || []).length;
  if (!phone || phone.length > PHONE_MAX || !PHONE_RE.test(phone) || digits < PHONE_MIN_DIGITS) {
    errors.push("phone");
  }

  const project = str(raw.project);
  if (!PROJECT_TYPES.includes(project)) errors.push("project");

  // Estricto a propósito: el consentimiento es el registro legal (FIPA/FTSA),
  // así que sólo un booleano `true` cuenta — nada de "true" ni 1.
  if (raw.consent !== true) errors.push("consent");

  const turnstileToken = str(raw.turnstileToken);
  if (!turnstileToken || turnstileToken.length > TOKEN_MAX) errors.push("captcha");

  if (errors.length) return { ok: false, errors };

  const lang = LANGS.includes(raw.lang) ? raw.lang : DEFAULT_LANG;

  const value = { name, email, phone, project_type: project, lang, consent: 1, turnstileToken };
  for (const key of UTM_KEYS) value[key] = cleanUtm(raw[key]);

  return { ok: true, value };
}
