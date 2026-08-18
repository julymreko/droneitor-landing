import { describe, it, expect } from "vitest";
import {
  lastCompletedWeek,
  previousWeek,
  miamiDayAndBucket,
  miamiDateKey
} from "../src/reporting-window.js";

const HOUR_MS = 60 * 60 * 1000;
const hoursBetween = (w) => (Date.parse(w.endUtc) - Date.parse(w.startUtc)) / HOUR_MS;

describe("lastCompletedWeek", () => {
  it("desde un lunes de madrugada devuelve la semana que acaba de cerrar", () => {
    // Lunes 2026-08-17 06:00 UTC = 02:00 EDT, que es cuando dispara el cron.
    // La semana completa es la anterior (10–16), no la que empezó hace 2 horas.
    const w = lastCompletedWeek(new Date("2026-08-17T06:00:00Z"));

    expect(w.startUtc).toBe("2026-08-10T04:00:00.000Z"); // lunes 00:00 EDT
    expect(w.endUtc).toBe("2026-08-17T04:00:00.000Z");
    expect(w.periodShort).toBe("Aug 10–16, 2026");
    expect(w.periodLong).toBe("August 10–16, 2026");
  });

  it("usa el offset de invierno cuando toca, sin codificar EST ni EDT", () => {
    const w = lastCompletedWeek(new Date("2026-01-19T06:00:00Z"));

    expect(w.startUtc).toBe("2026-01-12T05:00:00.000Z"); // lunes 00:00 EST
    expect(w.endUtc).toBe("2026-01-19T05:00:00.000Z");
  });

  it("la semana del cambio a horario de verano dura 167 horas", () => {
    // DST 2026 empieza el domingo 8 de marzo: esa semana pierde una hora.
    const w = lastCompletedWeek(new Date("2026-03-09T06:00:00Z"));

    expect(w.startUtc).toBe("2026-03-02T05:00:00.000Z"); // lunes 00:00 EST
    expect(w.endUtc).toBe("2026-03-09T04:00:00.000Z"); // lunes 00:00 EDT
    expect(hoursBetween(w)).toBe(167);
    expect(w.periodShort).toBe("Mar 2–8, 2026");
  });

  it("la semana del cambio a horario de invierno dura 169 horas", () => {
    // DST 2026 termina el domingo 1 de noviembre: esa semana gana una hora.
    const w = lastCompletedWeek(new Date("2026-11-02T06:00:00Z"));

    expect(w.startUtc).toBe("2026-10-26T04:00:00.000Z"); // lunes 00:00 EDT
    expect(w.endUtc).toBe("2026-11-02T05:00:00.000Z"); // lunes 00:00 EST
    expect(hoursBetween(w)).toBe(169);
    expect(w.periodShort).toBe("Oct 26 – Nov 1, 2026");
  });

  it("desde media semana sigue devolviendo la última semana completa", () => {
    // Un jueves: la semana en curso no ha cerrado, así que no se reporta.
    const w = lastCompletedWeek(new Date("2026-08-20T18:00:00Z"));

    expect(w.startUtc).toBe("2026-08-10T04:00:00.000Z");
    expect(w.endUtc).toBe("2026-08-17T04:00:00.000Z");
  });

  it("un domingo por la noche no reporta la semana que aún está corriendo", () => {
    // Domingo 16 a las 23:00 Miami = lunes 17 03:00 UTC. Faltan 60 minutos para
    // que cierre la semana del 10–16, así que la completa sigue siendo la del 3–9.
    const w = lastCompletedWeek(new Date("2026-08-17T03:00:00Z"));

    expect(w.startUtc).toBe("2026-08-03T04:00:00.000Z");
    expect(w.endUtc).toBe("2026-08-10T04:00:00.000Z");
  });

  it("cruza el cambio de año sin romper la etiqueta del periodo", () => {
    const w = lastCompletedWeek(new Date("2027-01-04T06:00:00Z"));

    expect(w.periodShort).toBe("Dec 28, 2026 – Jan 3, 2027");
    expect(w.startUtc).toBe("2026-12-28T05:00:00.000Z");
  });

  it("la clave de idempotencia es el lunes de Miami, no el día UTC", () => {
    // startUtc cae a las 04:00 del lunes en UTC; la clave debe ser ese lunes.
    const w = lastCompletedWeek(new Date("2026-08-17T06:00:00Z"));
    expect(w.periodKey).toBe("2026-08-10");
  });

  it("dos ejecuciones distintas dentro del mismo lunes dan la misma clave", () => {
    const a = lastCompletedWeek(new Date("2026-08-17T06:00:00Z"));
    const b = lastCompletedWeek(new Date("2026-08-17T23:30:00Z"));
    expect(a.periodKey).toBe(b.periodKey);
    expect(a.startUtc).toBe(b.startUtc);
  });
});

describe("previousWeek", () => {
  it("encaja exacto con la ventana actual, sin hueco ni solapamiento", () => {
    const current = lastCompletedWeek(new Date("2026-08-17T06:00:00Z"));
    const prev = previousWeek(current);

    expect(prev.endUtc).toBe(current.startUtc);
    expect(prev.startUtc).toBe("2026-08-03T04:00:00.000Z");
    expect(hoursBetween(prev)).toBe(168);
  });

  it("mantiene el encaje aunque la semana anterior cambie de horario", () => {
    const current = lastCompletedWeek(new Date("2026-03-16T06:00:00Z"));
    const prev = previousWeek(current);

    expect(prev.endUtc).toBe(current.startUtc);
    expect(hoursBetween(prev)).toBe(167); // la del cambio a verano
  });
});

describe("miamiDayAndBucket", () => {
  it("un lead del domingo por la noche cuenta como domingo, no como lunes UTC", () => {
    // 2026-08-17T01:30Z es domingo 16 a las 21:30 en Miami.
    const r = miamiDayAndBucket("2026-08-17T01:30:00.000Z");
    expect(r.dayIndex).toBe(6); // 0 = lunes
    expect(r.hour).toBe(21);
    expect(r.bucket).toBe(3); // 6:00 PM–11:59 PM
  });

  it("clasifica las cuatro franjas por su borde inferior", () => {
    expect(miamiDayAndBucket("2026-08-11T04:00:00.000Z").bucket).toBe(0); // 00:00 Miami
    expect(miamiDayAndBucket("2026-08-11T10:00:00.000Z").bucket).toBe(1); // 06:00
    expect(miamiDayAndBucket("2026-08-11T16:00:00.000Z").bucket).toBe(2); // 12:00
    expect(miamiDayAndBucket("2026-08-11T22:00:00.000Z").bucket).toBe(3); // 18:00
  });

  it("devuelve null si la fecha no es válida en vez de un día equivocado", () => {
    expect(miamiDayAndBucket("no-es-fecha")).toBeNull();
  });
});

describe("miamiDateKey", () => {
  it("usa el día de Miami y no el UTC en la madrugada", () => {
    // 03:00 UTC del 17 es todavía el 16 en Miami.
    expect(miamiDateKey(new Date("2026-08-17T03:00:00Z"))).toBe("2026-08-16");
  });
});
