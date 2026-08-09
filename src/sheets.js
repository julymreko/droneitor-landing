/**
 * Replicación de leads a Google Sheets vía service account.
 *
 * Flujo estándar de Google para servidor-a-servidor, sin intervención humana:
 *   JWT firmado con RS256 -> se canjea por un access token -> values:append
 *
 * Los Workers traen Web Crypto de serie, así que la firma RS256 se hace con
 * `crypto.subtle` — sin dependencias ni `nodejs_compat`.
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_TTL = 3600;

/** Orden de las columnas de la hoja. La fila de encabezados debe coincidir. */
export const SHEET_COLUMNS = [
  "created_at", "name", "email", "phone", "project_type", "lang",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "country", "region", "city", "ip", "user_agent", "id"
];

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

/**
 * Convierte una clave privada PEM (PKCS#8) en los bytes DER que espera
 * `crypto.subtle.importKey`.
 *
 * Acepta tanto saltos de línea reales como `\n` literales: el campo
 * `private_key` del JSON de Google los trae escapados, y según cómo se pegue
 * al ejecutar `wrangler secret put` puede llegar de cualquiera de las dos formas.
 */
export function pemToPkcs8(pem) {
  const normalized = String(pem).replace(/\\n/g, "\n").trim();
  const match = normalized.match(
    /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/
  );
  if (!match) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY no parece un PEM PKCS#8: falta la cabecera BEGIN PRIVATE KEY."
    );
  }
  const b64 = match[1].replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

/** Firma el JWT que Google canjea por un access token. */
export async function signJwt({ email, privateKeyPem, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signingInput =
    b64urlJson({ alg: "RS256", typ: "JWT" }) + "." +
    b64urlJson({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + TOKEN_TTL
    });

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${b64url(signature)}`;
}

// Cache a nivel de módulo: sobrevive mientras el isolate siga caliente, así una
// ráfaga de leads no pide un token nuevo por cada uno. Si el isolate muere se
// pide otro, que es exactamente el comportamiento correcto.
let cachedToken = null;

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const assertion = await signJwt({
    email: env.GOOGLE_SA_EMAIL,
    privateKeyPem: env.GOOGLE_SA_PRIVATE_KEY,
    nowSeconds: now
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!res.ok) {
    throw new Error(`Google rechazó el JWT (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: now + (data.expires_in || TOKEN_TTL) };
  return cachedToken.token;
}

/**
 * Aplana un lead a una fila, en el orden de SHEET_COLUMNS.
 *
 * Se escribe con valueInputOption=RAW, así que Sheets no evalúa fórmulas; aun
 * así se antepone `'` a lo que empiece por = + - @ porque estas hojas se
 * exportan a CSV y Excel *sí* las ejecuta al abrirlas.
 */
export function leadToRow(lead) {
  return SHEET_COLUMNS.map((col) => {
    const value = lead[col];
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /^[=+\-@]/.test(s) ? `'${s}` : s;
  });
}

/** Añade el lead como una fila nueva. Lanza si Google responde error. */
export async function appendLead(env, lead) {
  const token = await getAccessToken(env);
  const range = encodeURIComponent(`${env.SHEETS_TAB || "Leads"}!A:A`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${range}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [leadToRow(lead)] })
  });

  if (!res.ok) {
    throw new Error(`Sheets append falló (${res.status}): ${await res.text()}`);
  }
}
