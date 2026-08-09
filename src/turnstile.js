/**
 * Verificación del token de Cloudflare Turnstile.
 *
 * El widget del cliente sólo demuestra que se resolvió el reto en el navegador;
 * el token no vale nada hasta que el servidor lo canjea aquí. Sin esta llamada,
 * cualquiera podría hacer POST al endpoint saltándose el widget entero.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * @returns {Promise<{success: boolean, challenge_ts: string|null,
 *   hostname: string|null, action: string|null, cdata: string|null,
 *   errorCodes: string[]}>}
 */
export async function verifyTurnstile({ secret, token, ip }) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  let data;
  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    data = await res.json();
  } catch (err) {
    // Si Cloudflare no responde, se falla cerrado: no se guarda el lead.
    // Es preferible a abrir la puerta a los bots ante un fallo de red.
    console.error("Turnstile siteverify inalcanzable:", err);
    return { success: false, challenge_ts: null, hostname: null, action: null, cdata: null, errorCodes: ["network-error"] };
  }

  return {
    success: data.success === true,
    challenge_ts: data.challenge_ts ?? null,
    hostname: data.hostname ?? null,
    action: data.action ?? null,
    cdata: data.cdata ?? null,
    errorCodes: data["error-codes"] ?? []
  };
}
