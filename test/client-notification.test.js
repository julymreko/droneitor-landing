import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildClientNotificationPayload,
  formatLeadTimestamp,
  sendClientNotification
} from "../src/client-notification.js";

const lead = {
  id: 42,
  name: "Ana Ruiz",
  email: "ana@example.com",
  phone: "+1 (305) 123-4567",
  project_type: "real-estate",
  lang: "en",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "miami-real-estate",
  utm_content: null,
  utm_term: null,
  country: "US",
  region: "FL",
  city: "Miami",
  user_agent: "Mozilla/5.0...",
  ip: "192.168.1.1",
  created_at: "2026-08-11T20:45:30.000Z"
};

const env = {
  ZEPTOMAIL_API_KEY: "test-key-12345",
  ZEPTOMAIL_FROM_EMAIL: "no-reply@droneitor.com",
  ZEPTOMAIL_FROM_NAME: "Droneitor"
};

// Un placeholder sin reemplazar, para no confundirlo con una llave que venga
// dentro del valor de un UTM legítimo ("summer{2026}").
const UNREPLACED = /\{\w+\}/;

describe("formatLeadTimestamp", () => {
  it("convierte UTC a hora de Miami, que es Eastern y no Central", () => {
    // 20:45 UTC en agosto = 16:45 EDT (UTC-4). Con America/Chicago daban las
    // 15:45 y el correo igual decía "(Miami time)".
    expect(formatLeadTimestamp("2026-08-11T20:45:30.000Z")).toBe("2026-08-11 at 04:45 PM");
  });

  it("aplica el horario de invierno cuando toca", () => {
    // En enero Miami es EST (UTC-5), no EDT.
    expect(formatLeadTimestamp("2026-01-15T20:45:00.000Z")).toBe("2026-01-15 at 03:45 PM");
  });

  it("retrocede el día cuando en UTC ya es el día siguiente", () => {
    expect(formatLeadTimestamp("2026-08-12T03:00:00.000Z")).toBe("2026-08-11 at 11:00 PM");
  });

  it("devuelve el string original si no es una fecha", () => {
    expect(formatLeadTimestamp("invalid-date")).toBe("invalid-date");
  });
});

describe("buildClientNotificationPayload", () => {
  it("has required structure", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload).toHaveProperty("from");
    expect(payload).toHaveProperty("to");
    expect(payload).toHaveProperty("cc");
    expect(payload).toHaveProperty("subject");
    expect(payload).toHaveProperty("textbody");
    expect(payload).toHaveProperty("htmlbody");
    expect(payload).toHaveProperty("inline_images");
  });

  it("el remitente sale de la env var, con el nombre de la agencia", () => {
    // La dirección no se hardcodea: el dominio verificado en Zeptomail se
    // gestiona en un solo sitio (wrangler.jsonc), igual que el de bienvenida.
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.from).toEqual({ address: "no-reply@droneitor.com", name: "Tu Digital Marketing" });
  });

  it("recipient is Marco (TO)", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.to).toHaveLength(1);
    expect(payload.to[0].email_address.address).toBe("droneitor1983@gmail.com");
    expect(payload.to[0].email_address.name).toBe("Marco Beas");
  });

  it("CC includes Julian", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.cc).toHaveLength(1);
    expect(payload.cc[0].email_address.address).toBe("cj.cely@hotmail.com");
    expect(payload.cc[0].email_address.name).toBe("Julian Cely");
  });

  it("subject is correct", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.subject).toContain("Droneitor");
    expect(payload.subject).toContain("New lead");
  });

  it("replaces all placeholders in HTML", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).not.toMatch(UNREPLACED);
  });

  it("replaces all placeholders in text", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.textbody).not.toMatch(UNREPLACED);
  });

  it("includes lead name (escaped for HTML)", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).toContain("Ana Ruiz");
    expect(payload.textbody).toContain("Ana Ruiz");
  });

  it("includes UTM data", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).toContain("google");
    expect(payload.htmlbody).toContain("cpc");
    expect(payload.htmlbody).toContain("miami-real-estate");
  });

  it("shows '—' for null UTM fields", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).toContain("—");
  });

  it("includes logo inline image", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.inline_images).toHaveLength(1);
    expect(payload.inline_images[0].cid).toBe("2dm-logo");
    expect(payload.inline_images[0].mime_type).toBe("image/png");
    expect(payload.inline_images[0].content.length).toBeGreaterThan(0);
    // Base64 crudo: el prefijo data: rompería la resolución del cid.
    expect(payload.inline_images[0].content.startsWith("data:")).toBe(false);
    expect(payload.inline_images[0].content.startsWith("iVBORw0KGgo")).toBe(true);
  });

  it("el cid de la imagen es el que referencia la plantilla", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).toContain(`src="cid:${payload.inline_images[0].cid}"`);
  });

  it("HTML and text have same data", () => {
    const payload = buildClientNotificationPayload(env, lead);
    expect(payload.htmlbody).toContain("Ana Ruiz");
    expect(payload.textbody).toContain("Ana Ruiz");
    expect(payload.htmlbody).toContain("miami-real-estate");
    expect(payload.textbody).toContain("miami-real-estate");
  });

  it("el textbody es texto de verdad: sin etiquetas ni entidades HTML", () => {
    const { textbody } = buildClientNotificationPayload(env, lead);
    expect(textbody).not.toMatch(/<[a-z][^>]*>/i);
    expect(textbody).not.toContain("&amp;");
  });
});

describe("buildClientNotificationPayload — escapado", () => {
  // Los UTM salen del query string y validate.js sólo los trunca: nunca filtra
  // caracteres. El user agent es una cabecera cruda. Los dos los controla quien
  // envía el formulario, y los dos acaban en un correo que abre el cliente.
  it("escapa los UTM: no se puede inyectar markup desde el query string", () => {
    const payload = buildClientNotificationPayload(env, {
      ...lead,
      utm_source: '</td></tr></table><img src="https://evil.test/pixel.png">'
    });
    expect(payload.htmlbody).not.toContain('<img src="https://evil.test/pixel.png">');
    expect(payload.htmlbody).toContain("&lt;img src=&quot;https://evil.test/pixel.png&quot;&gt;");
  });

  it("escapa el user agent, que es una cabecera cruda", () => {
    const payload = buildClientNotificationPayload(env, {
      ...lead,
      user_agent: '<script>alert(1)</script>'
    });
    expect(payload.htmlbody).not.toContain("<script>");
    expect(payload.htmlbody).toContain("&lt;script&gt;");
  });

  it("escapa el email: EMAIL_RE deja pasar < y > mientras no haya espacios", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, email: "<b>x</b>@evil.test" });
    expect(payload.htmlbody).not.toContain("<b>x</b>");
    expect(payload.htmlbody).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("escapa el nombre aunque validate.js ya lo restrinja", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, name: '<img src=x onerror="alert(1)">' });
    expect(payload.htmlbody).not.toContain("<img src=x");
    expect(payload.htmlbody).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("el texto plano no escapa: ahí no hay markup que romper", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, utm_campaign: "a & b" });
    expect(payload.textbody).toContain("a & b");
    expect(payload.htmlbody).toContain("a &amp; b");
  });
});

describe("buildClientNotificationPayload — sustitución de placeholders", () => {
  it("no interpreta los patrones $ del reemplazo", () => {
    // `replaceAll(x, "$&")` reinsertaba el propio placeholder en el correo.
    const payload = buildClientNotificationPayload(env, { ...lead, utm_medium: "$&" });
    expect(payload.htmlbody).not.toContain("{utm_medium}");
    expect(payload.htmlbody).toContain("$&amp;");
    expect(payload.textbody).toContain("$&");
  });

  it("no re-escanea lo ya sustituido: un UTM con forma de placeholder queda literal", () => {
    // Encadenar replaceAll hacía que `?utm_campaign={ip}` mostrara la IP real
    // del visitante en la fila de la campaña.
    const payload = buildClientNotificationPayload(env, { ...lead, utm_campaign: "{ip}", ip: "203.0.113.9" });
    expect(payload.htmlbody).toContain("{ip}");
    expect(payload.textbody).toContain("{ip}");
    // La IP sale una sola vez: en su propia fila, no en la de la campaña.
    expect(payload.htmlbody.match(/203\.0\.113\.9/g)).toHaveLength(1);
  });

  it("trunca el user agent sin partir una entidad HTML", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, user_agent: "<".repeat(200) });
    expect(payload.textbody).toContain("<".repeat(100));
    expect(payload.textbody).not.toContain("<".repeat(101));
    expect(payload.htmlbody).not.toMatch(/&l;|&lt$/);
  });
});

describe("buildClientNotificationPayload — campos ausentes", () => {
  it("no revienta con un lead mínimo y marca lo que falta con em dash", () => {
    const payload = buildClientNotificationPayload(env, { id: 7, created_at: "2026-08-11T20:45:30.000Z" });
    expect(payload.htmlbody).not.toMatch(UNREPLACED);
    expect(payload.textbody).not.toMatch(UNREPLACED);
    expect(payload.textbody).toContain("Name                             | —");
    expect(payload.textbody).toContain("Email                            | —");
  });

  it("un id 0 se muestra como 0, no como campo vacío", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, id: 0 });
    expect(payload.textbody).toContain("Lead ID                          | 0");
  });

  it("una fecha ausente no rompe el envío y se marca como el resto", () => {
    const payload = buildClientNotificationPayload(env, { ...lead, created_at: null });
    expect(payload.htmlbody).not.toMatch(UNREPLACED);
    expect(payload.textbody).toContain("Received                         | — (Miami time)");
  });
});

describe("sendClientNotification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hace POST a Zeptomail con la api key y el payload", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendClientNotification(env, lead);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.zeptomail.com/v1.1/email");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Zoho-enczapikey test-key-12345");
    expect(JSON.parse(init.body).subject).toContain("New lead");
  });

  it("lanza si Zeptomail responde error, para que el llamador lo registre", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(sendClientNotification(env, lead)).rejects.toThrow(/401/);
  });
});
