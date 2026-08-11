import { describe, it, expect } from "vitest";
import { buildWelcomeEmailBody, buildWelcomeEmailPayload } from "../src/zeptomail.js";

const lead = {
  id: 42,
  name: "Ana Ruiz",
  email: "ana@example.com",
  lang: "en"
};

describe("buildWelcomeEmailBody", () => {
  it("incluye siempre el bloque en inglés", () => {
    const body = buildWelcomeEmailBody(lead);
    expect(body).toContain("Thanks for reaching out");
    expect(body).toContain("Ana Ruiz");
  });

  it("no agrega español si lang es 'en': ni divisor ni encabezado español", () => {
    const body = buildWelcomeEmailBody({ ...lead, lang: "en" });
    expect(body).not.toContain("ESPAÑOL");
    expect(body).not.toContain("Tu descuento del 10%");
    expect(body).not.toContain("Gracias por comunicarte");
  });

  it("agrega el bloque en español debajo del inglés si lang es 'es'", () => {
    const body = buildWelcomeEmailBody({ ...lead, lang: "es" });
    expect(body).toContain("Thanks for reaching out");
    expect(body).toContain("ESPAÑOL");
    expect(body).toContain("Gracias por comunicarte");
    expect(body.indexOf("Thanks for reaching out")).toBeLessThan(
      body.indexOf("Gracias por comunicarte")
    );
  });

  it("nunca decide el idioma por su cuenta: usa lead.lang tal cual llega", () => {
    // validate.js ya normaliza a "en"/"es" antes de que esto se llame —
    // acá sólo nos importa que respete exactamente lo que le pasan.
    expect(buildWelcomeEmailBody({ ...lead, lang: "es" })).toContain("Hola Ana Ruiz");
  });

  it("cierra el documento y conserva el pie en los dos idiomas", () => {
    for (const lang of ["en", "es"]) {
      const body = buildWelcomeEmailBody({ ...lead, lang });
      expect(body).toContain("Aerial perspectives. Precisely delivered.");
      expect(body.trimEnd().endsWith("</html>")).toBe(true);
    }
  });

  it("no deja ningún placeholder {name} sin reemplazar", () => {
    for (const lang of ["en", "es"]) {
      expect(buildWelcomeEmailBody({ ...lead, lang })).not.toContain("{name}");
    }
  });

  it("referencia el logo por content-id, no por URL externa", () => {
    expect(buildWelcomeEmailBody(lead)).toContain('src="cid:droneitor-wordmark"');
  });

  it("el contacto de WhatsApp usa el icono de teléfono, sin el badge 'WA'", () => {
    for (const lang of ["en", "es"]) {
      const body = buildWelcomeEmailBody({ ...lead, lang });
      expect(body).toContain("&#128222;");
      expect(body).not.toContain(">WA<");
      expect(body).toContain("+1 (786) 656-2397");
    }
  });

  it("escapa el nombre: no puede inyectar markup en el HTML del correo", () => {
    // validate.js ya rechaza estos nombres, pero el correo no debe depender
    // de eso para ser seguro.
    const body = buildWelcomeEmailBody({ ...lead, name: '<img src=x onerror="alert(1)">' });
    expect(body).not.toContain("<img src=x");
    expect(body).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("buildWelcomeEmailPayload", () => {
  const env = { ZEPTOMAIL_FROM_EMAIL: "no-reply@droneitor.com", ZEPTOMAIL_FROM_NAME: "Droneitor" };

  it("arma el remitente desde las env vars, no hardcodeado", () => {
    const payload = buildWelcomeEmailPayload(env, lead);
    expect(payload.from).toEqual({ address: "no-reply@droneitor.com", name: "Droneitor" });
  });

  it("arma un único destinatario a partir del lead", () => {
    const payload = buildWelcomeEmailPayload(env, lead);
    expect(payload.to).toEqual([
      { email_address: { address: "ana@example.com", name: "Ana Ruiz" } }
    ]);
  });

  it("manda htmlbody y textbody juntos — multipart, no uno u otro", () => {
    const payload = buildWelcomeEmailPayload(env, lead);
    expect(payload.htmlbody).toContain("<!doctype html>");
    expect(payload.textbody).toBeTypeOf("string");
    expect(payload.textbody.length).toBeGreaterThan(0);
  });

  it("el textbody es texto de verdad: sin etiquetas ni entidades HTML", () => {
    const { textbody } = buildWelcomeEmailPayload(env, { ...lead, lang: "es" });
    expect(textbody).not.toMatch(/<[a-z][^>]*>/i);
    expect(textbody).not.toContain("&#");
    expect(textbody).not.toContain("&amp;");
  });

  it("las dos partes coinciden en idioma", () => {
    const en = buildWelcomeEmailPayload(env, { ...lead, lang: "en" });
    expect(en.textbody).not.toContain("Gracias por comunicarte");
    expect(en.htmlbody).not.toContain("ESPAÑOL");

    const es = buildWelcomeEmailPayload(env, { ...lead, lang: "es" });
    expect(es.textbody).toContain("Gracias por comunicarte");
    expect(es.htmlbody).toContain("ESPAÑOL");
  });

  it("las dos partes no se contradicen: mismas afirmaciones y mismos contactos", () => {
    // Un multipart cuyas dos mitades dicen cosas distintas puntúa peor en los
    // filtros, que es justo lo que el textbody vino a evitar. Si se cambia el
    // copy de un lado, este test obliga a cambiar el del otro.
    const { textbody, htmlbody } = buildWelcomeEmailPayload(env, { ...lead, lang: "es" });
    for (const parte of [textbody, htmlbody]) {
      expect(parte).toContain("confirmed and active immediately");
      expect(parte).toContain("Our team will be in touch shortly");
      expect(parte).toContain("activo de inmediato");
      expect(parte).toContain("contact@droneitor.com");
      expect(parte).toContain("+1 (786) 656-2397");
    }
  });

  it("adjunta el wordmark como imagen inline con el cid que usa la plantilla", () => {
    const payload = buildWelcomeEmailPayload(env, lead);
    expect(payload.inline_images).toHaveLength(1);

    const [img] = payload.inline_images;
    expect(img.cid).toBe("droneitor-wordmark");
    expect(img.mime_type).toBe("image/png");
    expect(img.content.length).toBeGreaterThan(0);
    // Base64 crudo: el prefijo data: rompería la resolución del cid.
    expect(img.content.startsWith("data:")).toBe(false);
    // Firma PNG en base64 — confirma que es el binario y no un placeholder.
    expect(img.content.startsWith("iVBORw0KGgo")).toBe(true);
  });

  it("incluye un subject no vacío", () => {
    expect(buildWelcomeEmailPayload(env, lead).subject.length).toBeGreaterThan(0);
  });
});
