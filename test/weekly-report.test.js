import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildSubject,
  escapeHtml,
  renderWeeklyReportHtml,
  renderWeeklyReportText,
  safeMailto,
  safeTel
} from "../src/weekly-report-template.js";
import {
  buildReportPayload,
  maskAddress,
  parseRecipients,
  resolveMode,
  resolveRecipients,
  runWeeklyReport
} from "../src/weekly-report.js";
import { aggregate } from "../src/weekly-report-data.js";

const WINDOW = {
  startUtc: "2026-08-10T04:00:00.000Z",
  endUtc: "2026-08-17T04:00:00.000Z",
  periodKey: "2026-08-10",
  periodShort: "Aug 10–16, 2026",
  periodLong: "August 10–16, 2026"
};

const lead = (over = {}) => ({
  id: 1,
  name: "Ana Ruiz",
  email: "ana@example.com",
  phone: "305-555-0101",
  project_type: "real-estate",
  lang: "en",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "miami-re",
  utm_content: null,
  utm_term: null,
  country: "US",
  region: "FL",
  city: "Miami",
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  created_at: "2026-08-11T14:00:00.000Z",
  ...over
});

const modelOf = (leads, previousCount = 0) => aggregate({ leads, window: WINDOW, previousCount });

const CTX = { mode: "test", generatedAt: "Aug 17, 2026, 2:00 AM (Miami time)", salutation: "Julian" };
const PROD_CTX = { ...CTX, mode: "production", salutation: "Marco and Julian" };

/* ------------------------------------------------------------------ */

describe("buildSubject", () => {
  it("marca inequívocamente el modo test", () => {
    expect(buildSubject(modelOf([lead()]), CTX)).toBe(
      "[TEST] Droneitor | Weekly Lead Report | Aug 10–16, 2026 | 1 lead"
    );
  });

  it("en producción va sin marca", () => {
    const s = buildSubject(modelOf([lead(), lead({ id: 2 })]), PROD_CTX);
    expect(s).toBe("Droneitor | Weekly Lead Report | Aug 10–16, 2026 | 2 leads");
    expect(s).not.toMatch(/TEST/);
  });

  it("concuerda el singular con un solo lead", () => {
    expect(buildSubject(modelOf([lead()]), PROD_CTX)).toMatch(/\| 1 lead$/);
    expect(buildSubject(modelOf([lead(), lead({ id: 2 })]), PROD_CTX)).toMatch(/\| 2 leads$/);
  });
});

describe("safeMailto / safeTel", () => {
  it("enlaza direcciones y teléfonos normales", () => {
    expect(safeMailto("ana@example.com")).toBe("mailto:ana%40example.com");
    expect(safeTel("305-555-0101")).toBe("tel:3055550101");
  });

  it("no construye enlace con basura en vez de dirección", () => {
    expect(safeMailto('a" onmouseover="alert(1)')).toBeNull();
    expect(safeMailto("javascript:alert(1)")).toBeNull();
    expect(safeMailto("")).toBeNull();
    expect(safeTel("no-es-telefono")).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("neutraliza markup y comillas de atributo", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });
});

describe("renderWeeklyReportHtml — seguridad", () => {
  it("escapa lo que viene de la base, incluido un UTM hostil", () => {
    const html = renderWeeklyReportHtml(
      modelOf([
        lead({
          name: '<script>alert("xss")</script>',
          utm_campaign: '"><img src=x onerror=alert(1)>'
        })
      ]),
      CTX
    );

    // Lo que importa no es que la subcadena "onerror" desaparezca —sigue ahí,
    // como texto— sino que no llegue a existir una etiqueta que el cliente
    // pueda ejecutar. Por eso se comprueba el markup, no el texto.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toMatch(/&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
    expect(html).toMatch(/&lt;img src=x onerror=alert\(1\)&gt;/);
  });

  it("no expone la IP ni el user agent crudo", () => {
    const html = renderWeeklyReportHtml(
      modelOf([lead({ user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0" })]),
      CTX
    );

    expect(html).not.toMatch(/203\.0\.113|192\.168|Mozilla\/5\.0/);
    expect(html).toMatch(/Desktop/); // sí la clasificación derivada
  });

  it("no enlaza un email inválido pero sí muestra su texto escapado", () => {
    const html = renderWeeklyReportHtml(modelOf([lead({ email: 'x" onmouseover="alert(1)' })]), CTX);
    expect(html).not.toMatch(/mailto:x/);
    expect(html).not.toMatch(/onmouseover="alert/);
  });
});

describe("renderWeeklyReportHtml — requisitos de cliente de correo", () => {
  const html = renderWeeklyReportHtml(modelOf([lead()]), CTX);

  it("no depende del tema del cliente", () => {
    expect(html).not.toMatch(/prefers-color-scheme/);
    expect(html).not.toMatch(/@media/);
  });

  it("no carga nada externo ni ejecuta scripts", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(css|js|woff|png|jpg|gif)/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/background-image|<svg|<canvas|<form/i);
  });

  it("trae las metas que necesitan los clientes de correo", () => {
    expect(html).toMatch(/x-apple-disable-message-reformatting/);
    expect(html).toMatch(/<meta name="viewport"/);
  });

  it("lleva preheader oculto", () => {
    expect(html).toMatch(/display:none;max-height:0/);
  });

  it("no usa emoji como indicador de negocio", () => {
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u);
  });

  it("declara fondo y color de texto juntos en el body", () => {
    expect(html).toMatch(/<body style="[^"]*background-color:[^"]*color:/);
  });

  it("usa tablas de layout marcadas como presentación", () => {
    expect(html).toMatch(/role="presentation"/);
  });
});

describe("renderWeeklyReportHtml — contenido", () => {
  it("avisa del modo test en el cuerpo, no solo en el asunto", () => {
    expect(renderWeeklyReportHtml(modelOf([lead()]), CTX)).toMatch(/TEST REPORT/);
  });

  it("en producción no queda rastro del aviso de prueba", () => {
    expect(renderWeeklyReportHtml(modelOf([lead()]), PROD_CTX)).not.toMatch(/TEST REPORT/);
  });

  it("acompaña el cambio semanal con una palabra, no solo con color", () => {
    const html = renderWeeklyReportHtml(modelOf([lead(), lead({ id: 2 })], 1), PROD_CTX);
    expect(html).toMatch(/Up from 1 lead the previous week/);
  });

  it("muestra los siete días aunque tengan cero", () => {
    const html = renderWeeklyReportHtml(modelOf([lead()]), CTX);
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      expect(html).toContain(day);
    }
  });

  it("dice que la atribución falta, no que el tráfico sea directo confirmado", () => {
    const html = renderWeeklyReportHtml(modelOf([lead({ utm_source: null })]), CTX);
    expect(html).toMatch(/missing attribution, not confirmed direct or organic/);
  });
});

describe("renderWeeklyReportText", () => {
  it("lleva la misma información de negocio que el HTML", () => {
    const model = modelOf([lead(), lead({ id: 2, project_type: "events" })], 1);
    const text = renderWeeklyReportText(model, PROD_CTX);

    expect(text).toContain(model.window.periodLong);
    expect(text).toContain(model.insight);
    expect(text).toMatch(/Total leads\s+2/);
    expect(text).toMatch(/Weekly change\s+\+100%/);
    expect(text).toContain("Real Estate");
    expect(text).toContain("Events");
    expect(text).toContain("ana@example.com");
  });

  it("marca el modo test", () => {
    expect(renderWeeklyReportText(modelOf([lead()]), CTX)).toMatch(/TEST REPORT/);
  });

  it("no filtra IP ni user agent", () => {
    const text = renderWeeklyReportText(modelOf([lead()]), CTX);
    expect(text).not.toMatch(/Mozilla|203\.0\.113/);
  });

  it("no deja NaN, Infinity ni undefined a la vista", () => {
    expect(renderWeeklyReportText(modelOf([lead()], 0), CTX)).not.toMatch(/NaN|Infinity|undefined|null/);
  });
});

/* ------------------------------------------------------------------ */

describe("resolveMode", () => {
  it("solo 'production' exacto habilita producción", () => {
    expect(resolveMode({ REPORT_MODE: "production" })).toBe("production");
    expect(resolveMode({ REPORT_MODE: " Production " })).toBe("production");
  });

  it("cualquier otra cosa cae en test", () => {
    for (const value of [undefined, "", "test", "prod", "PRODUCCION", "1", "true", null]) {
      expect(resolveMode({ REPORT_MODE: value })).toBe("test");
    }
  });
});

describe("parseRecipients", () => {
  it("acepta 'Nombre <correo>' y correo pelado", () => {
    expect(parseRecipients("Julian Cely <cj@example.com>, otro@example.com")).toEqual([
      { address: "cj@example.com", name: "Julian Cely" },
      { address: "otro@example.com", name: "otro" }
    ]);
  });

  it("descarta entradas que no son direcciones en vez de mandarlas", () => {
    expect(parseRecipients("no-es-correo, ok@example.com")).toEqual([
      { address: "ok@example.com", name: "ok" }
    ]);
  });

  it("con la variable vacía devuelve lista vacía, no revienta", () => {
    expect(parseRecipients(undefined)).toEqual([]);
    expect(parseRecipients("")).toEqual([]);
  });
});

describe("resolveRecipients", () => {
  const env = {
    WEEKLY_REPORT_TEST_RECIPIENTS: "Julian Cely <cj.cely@hotmail.com>",
    WEEKLY_REPORT_PRODUCTION_RECIPIENTS: "Marco Beas <droneitor1983@gmail.com>, Julian Cely <cj.cely@hotmail.com>"
  };

  it("en test resuelve SOLO a Julian", () => {
    const r = resolveRecipients(env, "test");
    expect(r).toHaveLength(1);
    expect(r[0].address).toBe("cj.cely@hotmail.com");
  });

  it("Marco no aparece jamás en modo test", () => {
    expect(JSON.stringify(resolveRecipients(env, "test"))).not.toMatch(/droneitor1983/);
  });

  it("en producción resuelve a los dos", () => {
    expect(resolveRecipients(env, "production").map((r) => r.address)).toEqual([
      "droneitor1983@gmail.com",
      "cj.cely@hotmail.com"
    ]);
  });
});

describe("maskAddress", () => {
  it("deja rastro útil sin escribir la dirección", () => {
    expect(maskAddress("cj.cely@hotmail.com")).toBe("cj*****@hotmail.com");
    expect(maskAddress("cj.cely@hotmail.com")).not.toContain("cely");
  });
});

describe("buildReportPayload", () => {
  const report = {
    recipients: [{ address: "cj@example.com", name: "Julian" }],
    subject: "asunto",
    html: "<p>html</p>",
    text: "texto"
  };

  it("usa el remitente propio del reporte, no el del lead", () => {
    const payload = buildReportPayload({ REPORT_FROM_EMAIL: "support@droneitor.com" }, report);
    expect(payload.from.address).toBe("support@droneitor.com");
  });

  it("cae en support@droneitor.com si la var no está puesta", () => {
    expect(buildReportPayload({}, report).from.address).toBe("support@droneitor.com");
  });

  it("manda las dos partes del multipart", () => {
    const payload = buildReportPayload({}, report);
    expect(payload.htmlbody).toBe("<p>html</p>");
    expect(payload.textbody).toBe("texto");
  });
});

/* ------------------------------------------------------------------ *
 * Orquestación
 * ------------------------------------------------------------------ */

/** D1 de mentira: enruta por el SQL y registra lo que se le pidió. */
function fakeDb({ leads = [], previousCount = 0, claimSucceeds = true, existing = null } = {}) {
  const statements = [];

  return {
    statements,
    prepare(sql) {
      return {
        bind(...args) {
          statements.push({ sql, args });
          return {
            all: async () => ({ results: leads }),
            first: async () => {
              if (sql.includes("COUNT(*)")) return { n: previousCount };
              if (sql.includes("SELECT status")) return existing;
              return null;
            },
            run: async () => ({ meta: { changes: sql.includes("INSERT OR IGNORE") ? (claimSucceeds ? 1 : 0) : 1 } })
          };
        }
      };
    }
  };
}

const baseEnv = {
  // Valor distinguible a propósito: "key" a secas es subcadena de
  // "Zoho-enczapikey" y hacía pasar por bueno cualquier encabezado.
  ZEPTOMAIL_API_KEY: "token-agente-leads",
  REPORT_MODE: "test",
  WEEKLY_REPORT_TEST_RECIPIENTS: "Julian Cely <cj.cely@hotmail.com>",
  WEEKLY_REPORT_PRODUCTION_RECIPIENTS: "Marco Beas <droneitor1983@gmail.com>"
};

// Un lunes: la última semana completa es la del seed (10–16 de agosto).
const NOW = new Date("2026-08-17T06:00:00Z");

afterEach(() => vi.restoreAllMocks());

describe("runWeeklyReport", () => {
  it("con cero leads no llama a Zeptomail", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env = { ...baseEnv, DB: fakeDb({ leads: [], previousCount: 4 }) };

    const result = await runWeeklyReport(env, { now: NOW });

    expect(result.status).toBe("skipped_no_leads");
    expect(fetchSpy).not.toHaveBeenCalled();
    // Tampoco debe reclamar el periodo: no hay entrega que hacer idempotente.
    expect(env.DB.statements.some((s) => s.sql.includes("INSERT OR IGNORE"))).toBe(false);
  });

  it("con leads manda exactamente un correo y registra la entrega", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ request_id: "req-123" }), { status: 201 }));

    const env = { ...baseEnv, DB: fakeDb({ leads: [lead()], previousCount: 2 }) };
    const result = await runWeeklyReport(env, { now: NOW });

    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("req-123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(env.DB.statements.some((s) => s.sql.includes("UPDATE report_deliveries"))).toBe(true);
  });

  it("reclama el periodo ANTES de mandar, no después", async () => {
    const order = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      order.push("send");
      return new Response("{}", { status: 200 });
    });

    const db = fakeDb({ leads: [lead()] });
    const originalPrepare = db.prepare.bind(db);
    db.prepare = (sql) => {
      if (sql.includes("INSERT OR IGNORE")) order.push("claim");
      return originalPrepare(sql);
    };

    await runWeeklyReport({ ...baseEnv, DB: db }, { now: NOW });
    expect(order).toEqual(["claim", "send"]);
  });

  it("no reenvía un periodo ya entregado", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env = {
      ...baseEnv,
      DB: fakeDb({ leads: [lead()], claimSucceeds: false, existing: { status: "sent", sent_at: "2026-08-17T06:00:01Z" } })
    };

    const result = await runWeeklyReport(env, { now: NOW });

    expect(result.status).toBe("skipped_already_sent");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("libera la reclamación si Zeptomail falla, para que el reintento pueda", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream down", { status: 503 }));
    const env = { ...baseEnv, DB: fakeDb({ leads: [lead()] }) };

    await expect(runWeeklyReport(env, { now: NOW })).rejects.toThrow(/503/);
    expect(env.DB.statements.some((s) => s.sql.includes("DELETE FROM report_deliveries"))).toBe(true);
  });

  it("el dry-run genera el reporte sin mandar ni tocar la tabla", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env = { ...baseEnv, DB: fakeDb({ leads: [lead()] }) };

    const result = await runWeeklyReport(env, { now: NOW, dryRun: true });

    expect(result.status).toBe("dry_run");
    expect(result.report.html).toMatch(/Weekly Lead Report/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(env.DB.statements.some((s) => s.sql.includes("INSERT OR IGNORE"))).toBe(false);
  });

  it("sin destinatarios válidos no manda nada", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env = { ...baseEnv, WEEKLY_REPORT_TEST_RECIPIENTS: "", DB: fakeDb({ leads: [lead()] }) };

    const result = await runWeeklyReport(env, { now: NOW });

    expect(result.status).toBe("skipped_no_recipients");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("en modo test el destinatario es solo Julian", async () => {
    let payload;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response("{}", { status: 200 });
    });

    await runWeeklyReport({ ...baseEnv, DB: fakeDb({ leads: [lead()] }) }, { now: NOW });

    expect(payload.to).toHaveLength(1);
    expect(payload.to[0].email_address.address).toBe("cj.cely@hotmail.com");
    expect(JSON.stringify(payload.to)).not.toMatch(/droneitor1983/);
    expect(payload.subject).toMatch(/^\[TEST\]/);
  });

  it("consulta la ventana correcta, semiabierta", async () => {
    const env = { ...baseEnv, DB: fakeDb({ leads: [] }) };
    await runWeeklyReport(env, { now: NOW });

    const q = env.DB.statements.find((s) => s.sql.includes("FROM leads") && s.sql.includes("SELECT id"));
    expect(q.args).toEqual(["2026-08-10T04:00:00.000Z", "2026-08-17T04:00:00.000Z"]);
    expect(q.sql).toMatch(/created_at >= \? AND created_at < \?/);
  });

  it("usa el token del agente del reporte, no el de los correos al lead", async () => {
    let auth;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      auth = init.headers.authorization;
      return new Response("{}", { status: 200 });
    });

    const env = { ...baseEnv, REPORT_ZEPTOMAIL_API_KEY: "agente-1-token", DB: fakeDb({ leads: [lead()] }) };
    await runWeeklyReport(env, { now: NOW });

    // El remitente support@ vive en otro Mail Agent que no-reply@, y en
    // Zeptomail cada agente firma con su propio token.
    expect(auth).toBe("Zoho-enczapikey agente-1-token");
    expect(auth).not.toContain(baseEnv.ZEPTOMAIL_API_KEY);
  });

  it("cae en la clave existente mientras no haya una propia", async () => {
    let auth;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      auth = init.headers.authorization;
      return new Response("{}", { status: 200 });
    });

    await runWeeklyReport({ ...baseEnv, DB: fakeDb({ leads: [lead()] }) }, { now: NOW });
    expect(auth).toBe("Zoho-enczapikey token-agente-leads");
  });

  it("sin ningún token no intenta el envío, para no confundirlo con un 401", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env = { ...baseEnv, ZEPTOMAIL_API_KEY: undefined, DB: fakeDb({ leads: [lead()] }) };

    const result = await runWeeklyReport(env, { now: NOW });

    expect(result.status).toBe("skipped_no_api_key");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(env.DB.statements.some((s) => s.sql.includes("INSERT OR IGNORE"))).toBe(false);
  });

  it("no escribe el token ni direcciones en claro en el log", async () => {
    const logs = [];
    vi.spyOn(console, "log").mockImplementation((m) => logs.push(String(m)));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await runWeeklyReport({ ...baseEnv, DB: fakeDb({ leads: [lead()] }) }, { now: NOW });

    const joined = logs.join("\n");
    expect(joined).not.toContain(baseEnv.ZEPTOMAIL_API_KEY);
    expect(joined).not.toContain("cj.cely@hotmail.com");
    expect(joined).toMatch(/cj\*+@hotmail\.com/);
  });
});
