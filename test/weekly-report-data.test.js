import { describe, it, expect } from "vitest";
import {
  aggregate,
  buildInsight,
  classifyDevice,
  distributePercentages,
  locationLabel,
  normalizeLead,
  projectLabel,
  weeklyChange
} from "../src/weekly-report-data.js";

const WINDOW = {
  startUtc: "2026-08-10T04:00:00.000Z",
  endUtc: "2026-08-17T04:00:00.000Z",
  periodKey: "2026-08-10",
  periodShort: "Aug 10–16, 2026",
  periodLong: "August 10–16, 2026"
};

/** Una fila de D1 con valores por defecto sanos, para variar solo lo relevante. */
const lead = (over = {}) => ({
  id: 1,
  name: "Ana Ruiz",
  email: "ana@example.com",
  phone: "305-555-0100",
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

const run = (leads, previousCount = 0) => aggregate({ leads, window: WINDOW, previousCount });

describe("classifyDevice", () => {
  it("cuenta el iPad como tablet aunque su user agent diga Mobile", () => {
    const ipad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
    expect(classifyDevice(ipad)).toBe("Tablet");
  });

  it("distingue Android teléfono de Android tablet por el token Mobile", () => {
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("Mobile");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14; SM-X200) Safari/537.36")).toBe("Tablet");
  });

  it("reconoce escritorio", () => {
    expect(classifyDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Desktop");
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Desktop");
  });

  it("ante lo desconocido no inventa categoría", () => {
    expect(classifyDevice("curl/8.4.0")).toBe("Other");
    expect(classifyDevice(null)).toBe("Unknown");
    expect(classifyDevice("   ")).toBe("Unknown");
  });
});

describe("projectLabel", () => {
  it("traduce los slugs conocidos", () => {
    expect(projectLabel("real-estate")).toBe("Real Estate");
    expect(projectLabel("construction")).toBe("Construction");
  });

  it("preserva un valor inesperado en vez de descartarlo", () => {
    expect(projectLabel("aerial_mapping")).toBe("Aerial Mapping");
  });

  it("no muestra null", () => {
    expect(projectLabel(null)).toBe("Unknown");
    expect(projectLabel("")).toBe("Unknown");
  });
});

describe("locationLabel", () => {
  it("omite las partes vacías en vez de escribir null", () => {
    expect(locationLabel({ city: "Miami", region: null, country: "US" })).toBe("Miami, US");
    expect(locationLabel({ city: null, region: null, country: null })).toBe("Unknown");
  });
});

describe("distributePercentages", () => {
  it("suma exactamente 100 donde el redondeo simple daría 99", () => {
    // Tres tercios: 33.33 cada uno redondea a 33 y suma 99.
    expect(distributePercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(distributePercentages([1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
  });

  it("reparte el sobrante de forma determinista ante empates", () => {
    expect(distributePercentages([1, 1, 1])).toEqual(distributePercentages([1, 1, 1]));
  });

  it("no divide por cero con la tabla vacía", () => {
    expect(distributePercentages([])).toEqual([]);
    expect(distributePercentages([0, 0])).toEqual([0, 0]);
  });
});

describe("weeklyChange", () => {
  it("calcula el porcentaje cuando hay base", () => {
    expect(weeklyChange(12, 10)).toMatchObject({ kind: "up", label: "+20%", previous: 10 });
    expect(weeklyChange(8, 10)).toMatchObject({ kind: "down", label: "−20%" });
  });

  it("dice New en vez de infinito cuando la semana previa fue cero", () => {
    const r = weeklyChange(5, 0);
    expect(r.label).toBe("New");
    expect(r.label).not.toMatch(/Infinity|NaN/);
  });

  it("dice No change con dos semanas en cero", () => {
    expect(weeklyChange(0, 0).label).toBe("No change");
  });

  it("nunca produce -0%", () => {
    expect(weeklyChange(10, 10).label).toBe("No change");
  });

  it("conserva el conteo previo para poder mostrarlo", () => {
    expect(weeklyChange(12, 10).previous).toBe(10);
  });
});

describe("aggregate — normalización de atribución", () => {
  it("agrupa variantes de mayúsculas y espacios como una sola fuente", () => {
    const model = run([
      lead({ id: 1, utm_source: "Google" }),
      lead({ id: 2, utm_source: "google" }),
      lead({ id: 3, utm_source: " GOOGLE " })
    ]);

    expect(model.bySource).toHaveLength(1);
    expect(model.bySource[0].count).toBe(3);
    expect(model.topSource.count).toBe(3);
  });

  it("etiqueta la falta de fuente como sin atribuir, no como orgánico", () => {
    const model = run([lead({ id: 1, utm_source: null, utm_medium: null, utm_campaign: null })]);

    expect(model.bySource[0].label).toBe("Direct / Unattributed");
    expect(model.bySource[0].label).not.toMatch(/organic/i);
    expect(model.unattributed).toEqual({ count: 1, share: 100 });
  });

  it("cuenta como atribuido completo solo lo que trae source, medium y campaign", () => {
    const model = run([
      lead({ id: 1 }),
      lead({ id: 2, utm_campaign: null }),
      lead({ id: 3, utm_source: null, utm_medium: null, utm_campaign: null })
    ]);

    expect(model.fullyAttributed.count).toBe(1);
    expect(model.unattributed.count).toBe(1);
  });

  it("nunca repite una etiqueta dentro de la misma tabla", () => {
    // Invariante general: si dos filas se agrupan por separado, tienen que
    // rotularse distinto. Un lead sin nada y otro con medium pero sin fuente
    // caían en cubos distintos y salían los dos como "Direct / Unattributed".
    const model = run([
      lead({ id: 1, utm_source: null, utm_medium: null, utm_campaign: null }),
      lead({ id: 2, utm_source: null, utm_medium: "referral", utm_campaign: null }),
      lead({ id: 3, utm_source: null, utm_medium: "email", utm_campaign: null })
    ]);

    for (const table of ["byProject", "bySourceMedium", "byCampaign", "bySource", "byLanguage", "byDevice", "byLocation"]) {
      const labels = model[table].map((r) => r.label);
      expect(new Set(labels).size, `${table} repite etiqueta: ${labels.join(" | ")}`).toBe(labels.length);
    }
  });

  it("distingue la ausencia total de fuente de la ausencia solo de fuente", () => {
    const model = run([
      lead({ id: 1, utm_source: null, utm_medium: null }),
      lead({ id: 2, utm_source: null, utm_medium: "referral" })
    ]);

    expect(model.bySourceMedium.map((r) => r.label).sort()).toEqual([
      "Direct / Unattributed",
      "Unattributed / referral"
    ]);
  });

  it("no propone una campaña top cuando ninguna fue informada", () => {
    const model = run([lead({ utm_campaign: null }), lead({ id: 2, utm_campaign: "  " })]);
    expect(model.topCampaign).toBeNull();
  });
});

describe("aggregate — actividad diaria", () => {
  it("muestra los siete días aunque haya ceros", () => {
    const model = run([lead({ created_at: "2026-08-11T14:00:00.000Z" })]);
    expect(model.daily.counts).toHaveLength(7);
    expect(model.daily.counts.filter((n) => n === 0)).toHaveLength(6);
  });

  it("asigna el lead del domingo por la noche al domingo, no al lunes UTC", () => {
    // 2026-08-17T01:00Z = domingo 16, 21:00 en Miami. Además cae DENTRO de la
    // ventana, cuyo fin exclusivo es 2026-08-17T04:00Z.
    const model = run([lead({ created_at: "2026-08-17T01:00:00.000Z" })]);
    expect(model.daily.counts[6]).toBe(1);
    expect(model.daily.counts[0]).toBe(0);
  });

  it("declara el día más fuerte cuando hay uno solo", () => {
    const model = run([
      lead({ id: 1, created_at: "2026-08-11T14:00:00.000Z" }),
      lead({ id: 2, created_at: "2026-08-11T16:00:00.000Z" }),
      lead({ id: 3, created_at: "2026-08-12T16:00:00.000Z" })
    ]);
    expect(model.daily.busiest).toBe("Tuesday");
    expect(model.daily.busiestTied).toBeNull();
  });

  it("ante un empate no afirma un ganador", () => {
    const model = run([
      lead({ id: 1, created_at: "2026-08-11T14:00:00.000Z" }),
      lead({ id: 2, created_at: "2026-08-12T14:00:00.000Z" })
    ]);
    expect(model.daily.busiest).toBeNull();
    expect(model.daily.busiestTied).toEqual(["Tuesday", "Wednesday"]);
  });
});

describe("aggregate — semana vacía", () => {
  it("no revienta ni produce NaN sin leads", () => {
    const model = run([], 0);

    expect(model.total).toBe(0);
    expect(model.topProject).toBeNull();
    expect(model.topSource).toBeNull();
    expect(model.daily.busiest).toBeNull();
    expect(model.unattributed.share).toBe(0);
    expect(JSON.stringify(model)).not.toMatch(/NaN|Infinity/);
  });
});

describe("aggregate — directorio operativo", () => {
  it("ordena de más reciente a más antiguo", () => {
    const model = run([
      lead({ id: 1, created_at: "2026-08-11T10:00:00.000Z" }),
      lead({ id: 2, created_at: "2026-08-14T10:00:00.000Z" }),
      lead({ id: 3, created_at: "2026-08-12T10:00:00.000Z" })
    ]);
    expect(model.directory.map((l) => l.id)).toEqual([2, 3, 1]);
  });

  it("incluye todos los leads sin omitir ninguno en silencio", () => {
    const many = Array.from({ length: 40 }, (_, i) => lead({ id: i + 1 }));
    expect(run(many).directory).toHaveLength(40);
  });

  it("no arrastra ip ni user agent crudo al modelo del directorio", () => {
    const model = run([lead({ user_agent: "Mozilla/5.0 (Windows NT 10.0) muy-largo" })]);
    const entry = model.directory[0];

    expect(entry).not.toHaveProperty("ip");
    expect(entry).not.toHaveProperty("user_agent");
    expect(entry.device).toBe("Desktop");
  });
});

describe("buildInsight", () => {
  it("lee como frase ejecutiva con los tres datos", () => {
    const model = run([lead(), lead({ id: 2 })], 1);
    expect(model.insight).toBe(
      "Lead volume increased 100% week over week, Real Estate was the leading service, and google generated the most leads."
    );
  });

  it("funciona con un solo lead y sin base previa", () => {
    const model = run([lead()], 0);
    expect(model.insight).toMatch(/first week with leads/);
    expect(model.insight).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("dice explícitamente cuando no hubo atribución", () => {
    const model = run([lead({ utm_source: null, utm_medium: null, utm_campaign: null })], 0);
    expect(model.insight).toMatch(/no campaign attribution was recorded/);
  });

  it("tiene mensaje propio para la semana sin leads", () => {
    expect(buildInsight({ total: 0 })).toBe("No leads were captured during this period.");
  });
});

describe("normalizeLead", () => {
  it("no deja pasar null ni undefined a la vista", () => {
    const n = normalizeLead(lead({ name: null, utm_source: null, city: null, region: null, country: null }));
    expect(n.name).toBe("Not provided");
    expect(n.source).toBe("");
    expect(n.location).toBe("Unknown");
    expect(JSON.stringify(n)).not.toMatch(/null|undefined/);
  });
});
