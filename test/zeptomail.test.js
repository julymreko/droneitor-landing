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

  it("no agrega español si lang es 'en'", () => {
    const body = buildWelcomeEmailBody({ ...lead, lang: "en" });
    expect(body).not.toContain("Gracias por tu interés");
  });

  it("agrega el bloque en español debajo del inglés si lang es 'es'", () => {
    const body = buildWelcomeEmailBody({ ...lead, lang: "es" });
    expect(body).toContain("Thanks for reaching out");
    expect(body).toContain("Gracias por tu interés");
    expect(body.indexOf("Thanks for reaching out")).toBeLessThan(
      body.indexOf("Gracias por tu interés")
    );
  });

  it("nunca decide el idioma por su cuenta: usa lead.lang tal cual llega", () => {
    // validate.js ya normaliza a "en"/"es" antes de que esto se llame —
    // acá sólo nos importa que respete exactamente lo que le pasan.
    expect(buildWelcomeEmailBody({ ...lead, lang: "es" })).toContain("Hola Ana Ruiz");
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

  it("manda sólo textbody — nunca htmlbody, el correo es texto plano", () => {
    const payload = buildWelcomeEmailPayload(env, lead);
    expect(payload.textbody).toBeTypeOf("string");
    expect(payload.htmlbody).toBeUndefined();
  });

  it("incluye un subject no vacío", () => {
    expect(buildWelcomeEmailPayload(env, lead).subject.length).toBeGreaterThan(0);
  });
});
