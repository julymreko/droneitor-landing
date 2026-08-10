import { describe, it, expect } from "vitest";
import { validateLead, PROJECT_TYPES } from "../src/validate.js";

/** Cuerpo mínimo válido; cada test lo modifica en lo que quiere probar. */
function body(overrides = {}) {
  return {
    name: "Ana Ruiz",
    email: "ana@example.com",
    phone: "305-555-0134",
    project: "real-estate",
    lang: "en",
    consent: true,
    turnstileToken: "0.abcdef",
    ...overrides
  };
}

describe("validateLead — cuerpo bien formado", () => {
  it("acepta un lead válido y devuelve los campos normalizados", () => {
    const r = validateLead(body());
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      name: "Ana Ruiz",
      email: "ana@example.com",
      phone: "305-555-0134",
      project_type: "real-estate",
      lang: "en",
      consent: 1
    });
  });

  it("recorta espacios y normaliza el email a minúsculas", () => {
    const r = validateLead(body({ name: "  Ana Ruiz  ", email: "  ANA@Example.COM " }));
    expect(r.ok).toBe(true);
    expect(r.value.name).toBe("Ana Ruiz");
    expect(r.value.email).toBe("ana@example.com");
  });

  it("acepta nombres internacionales reales — con acentos, guion y apóstrofo", () => {
    for (const name of ["José García", "François Müller", "O'Brien", "Ana-María", "李伟", "julian"]) {
      expect(validateLead(body({ name })).ok).toBe(true);
    }
  });

  it("exige exactamente 10 dígitos, sin importar el separador (guiones, espacios, sin nada)", () => {
    for (const phone of ["3055550134", "305 555 0134", "(305) 555-0134"]) {
      expect(validateLead(body({ phone })).ok).toBe(true);
    }
  });

  it("acepta los cuatro tipos de proyecto del <select>", () => {
    for (const project of PROJECT_TYPES) {
      expect(validateLead(body({ project })).ok).toBe(true);
    }
  });
});

describe("validateLead — rechazos", () => {
  it("rechaza un cuerpo que no es un objeto", () => {
    for (const bad of [null, undefined, "texto", 42, []]) {
      const r = validateLead(bad);
      expect(r.ok).toBe(false);
      expect(r.errors).toContain("body");
    }
  });

  it.each([
    ["nombre de una sola letra", { name: "A" }, "name"],
    ["nombre vacío tras recortar", { name: "   " }, "name"],
    ["nombre no-string", { name: 123 }, "name"],
    ["nombre con forma de URL — encontrado en producción, ver welcome email", { name: "www.pornhub.com" }, "name"],
    ["nombre con extensión de dominio no listada explícitamente (.io)", { name: "julian.io" }, "name"],
    ["nombre que es sólo la palabra 'www'", { name: "www" }, "name"],
    ["nombre que es sólo la palabra 'HTTPS' (mayúsculas)", { name: "HTTPS" }, "name"],
    ["nombre con forma de email", { name: "click@evil.com" }, "name"],
    ["nombre con forma de fórmula de hoja de cálculo", { name: "=cmd|'/c calc'!A1" }, "name"],
    ["nombre con tags HTML", { name: "<script>alert(1)</script>" }, "name"],
    ["nombre que arranca con guion o apóstrofo", { name: "-Ana" }, "name"],
    ["email sin @", { email: "anaexample.com" }, "email"],
    ["email sin dominio", { email: "ana@" }, "email"],
    ["email con espacios", { email: "a b@example.com" }, "email"],
    ["teléfono con menos de 10 dígitos", { phone: "12345" }, "phone"],
    ["teléfono con más de 10 dígitos", { phone: "305-555-01234" }, "phone"],
    ["teléfono con letras", { phone: "555-CALL-NOW" }, "phone"],
    ["tipo de proyecto fuera del enum", { project: "drone-racing" }, "project"],
    ["tipo de proyecto vacío", { project: "" }, "project"],
    ["consentimiento false", { consent: false }, "consent"],
    ["consentimiento ausente", { consent: undefined }, "consent"],
    ['consentimiento como string "true"', { consent: "true" }, "consent"],
    ["token de Turnstile vacío", { turnstileToken: "" }, "captcha"],
    ["token de Turnstile ausente", { turnstileToken: undefined }, "captcha"]
  ])("rechaza %s", (_label, patch, expectedError) => {
    const r = validateLead(body(patch));
    expect(r.ok).toBe(false);
    expect(r.errors).toContain(expectedError);
  });

  it("acumula todos los errores, no solo el primero", () => {
    const r = validateLead(body({ name: "A", email: "nope", consent: false }));
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining(["name", "email", "consent"]));
  });

  it("rechaza valores absurdamente largos en vez de guardarlos", () => {
    expect(validateLead(body({ name: "a".repeat(101) })).ok).toBe(false);
    expect(validateLead(body({ email: "a".repeat(250) + "@example.com" })).ok).toBe(false);
    expect(validateLead(body({ phone: "1".repeat(33) })).ok).toBe(false);
  });
});

describe("validateLead — idioma", () => {
  it("conserva un idioma soportado", () => {
    expect(validateLead(body({ lang: "es" })).value.lang).toBe("es");
  });

  it('cae a "en" ante un idioma desconocido o ausente en vez de fallar', () => {
    expect(validateLead(body({ lang: "fr" })).value.lang).toBe("en");
    expect(validateLead(body({ lang: undefined })).value.lang).toBe("en");
  });
});

describe("validateLead — parámetros UTM", () => {
  it("conserva los cinco parámetros UTM", () => {
    const utm = {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "miami-realestate-q3",
      utm_content: "ad-variant-b",
      utm_term: "drone photography miami"
    };
    expect(validateLead(body(utm)).value).toMatchObject(utm);
  });

  it("deja los UTM ausentes en null (tráfico directo)", () => {
    const { value } = validateLead(body());
    expect(value.utm_source).toBeNull();
    expect(value.utm_campaign).toBeNull();
  });

  it("trata los UTM en blanco como null", () => {
    expect(validateLead(body({ utm_source: "   " })).value.utm_source).toBeNull();
  });

  it("trunca UTM demasiado largos en lugar de rechazar el lead", () => {
    const r = validateLead(body({ utm_campaign: "x".repeat(500) }));
    expect(r.ok).toBe(true);
    expect(r.value.utm_campaign).toHaveLength(200);
  });

  it("ignora UTM que no son string en vez de romper el insert", () => {
    const r = validateLead(body({ utm_source: { evil: true }, utm_term: 42 }));
    expect(r.ok).toBe(true);
    expect(r.value.utm_source).toBeNull();
    expect(r.value.utm_term).toBeNull();
  });
});
