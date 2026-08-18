/**
 * Ventana semanal del reporte, en hora de Miami.
 *
 * El reporte cubre la última semana COMPLETA: lunes 00:00:00 a domingo
 * 23:59:59.999 hora de Miami. Internamente se maneja como intervalo semiabierto
 * [lunes 00:00 Miami, lunes siguiente 00:00 Miami) convertido a UTC, porque las
 * filas de `leads` guardan `created_at` en ISO-8601 UTC.
 *
 * Semiabierto y no cerrado: con `BETWEEN inicio AND fin` habría que elegir un
 * fin (23:59:59? .999? .999999?) y cualquier elección deja fuera las filas que
 * caen en el hueco, o las duplica contra la semana siguiente. Con `>= inicio AND
 * < fin` no hay hueco posible y las dos semanas contiguas encajan exactas.
 *
 * Miami es Eastern (America/New_York) y observa horario de verano, así que el
 * offset es -04:00 o -05:00 según la fecha. No se codifica ninguno de los dos:
 * se pregunta por el instante concreto.
 */

const MIAMI_TZ = "America/New_York";

/**
 * Offset de la zona en un instante dado, en milisegundos.
 *
 * Se formatea el instante en Miami, se re-lee como si esos campos fueran UTC, y
 * la diferencia contra el instante real es el offset. Es la vuelta habitual para
 * no depender de una librería de zonas: Workers trae ICU completo, así que
 * `Intl` ya sabe cuándo cambia el horario.
 */
function tzOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;

  // hourCycle h23 devuelve "24" para medianoche en algunos entornos ICU.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );

  return asIfUtc - date.getTime();
}

/**
 * Instante UTC de una hora de pared de Miami.
 *
 * Dos pasadas: la primera estima el offset con la hora naive, la segunda lo
 * corrige usando el instante ya aproximado. Hace falta porque el offset depende
 * del instante que estamos calculando — en un cambio de horario la primera
 * estimación puede caer del lado equivocado.
 *
 * Los saltos de DST en EE. UU. ocurren a las 2:00 AM local, así que la
 * medianoche que usa este módulo nunca cae en una hora inexistente ni ambigua.
 */
function miamiWallTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = naive - tzOffsetMs(new Date(naive), MIAMI_TZ);
  instant = naive - tzOffsetMs(new Date(instant), MIAMI_TZ);
  return new Date(instant);
}

/** Los campos de fecha de un instante, tal como se ven en el calendario de Miami. */
function miamiCalendarParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MIAMI_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;

  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS[parts.weekday]
  };
}

/**
 * Suma (o resta) días a una fecha de calendario, sin tocar husos.
 *
 * La aritmética va sobre una fecha UTC "pelada" que solo se usa como calendario:
 * un Date.UTC a medianoche no cruza mal ningún día porque UTC no tiene cambios
 * de horario. Restar bloques de 24h a un instante REAL sí falla — en la semana
 * del cambio a verano, el lunes 00:00 EDT menos 168h da las 23:00 EST del
 * domingo anterior, o sea el día equivocado. Separar calendario de instante es
 * lo que evita ese off-by-one.
 */
function shiftMiamiDate({ year, month, day }, deltaDays) {
  const proxy = new Date(Date.UTC(year, month - 1, day));
  proxy.setUTCDate(proxy.getUTCDate() + deltaDays);
  return {
    year: proxy.getUTCFullYear(),
    month: proxy.getUTCMonth() + 1,
    day: proxy.getUTCDate()
  };
}

const midnight = (date) => miamiWallTimeToUtc(date.year, date.month, date.day);

/**
 * La última semana COMPLETA respecto a `now`.
 *
 * Si `now` es un lunes de madrugada, la semana completa es la que acaba de
 * cerrar unas horas antes — no la que empezó a medianoche. De ahí el retroceso
 * de 7 días desde el lunes de la semana en curso.
 *
 * Devuelve `startUtc`/`endUtc` como ISO-8601 para comparar directo contra la
 * columna `created_at`, que se guarda con `toISOString()`.
 */
export function lastCompletedWeek(now = new Date()) {
  const today = miamiCalendarParts(now);

  // Días transcurridos desde el lunes de la semana en curso (domingo = 6).
  const daysSinceMonday = (today.weekday + 6) % 7;

  const startDate = shiftMiamiDate(today, -(daysSinceMonday + 7));
  const endDate = shiftMiamiDate(today, -daysSinceMonday);

  return buildWindow(midnight(startDate), midnight(endDate));
}

/** La semana inmediatamente anterior a una ventana dada, para el comparativo. */
export function previousWeek(window) {
  // startUtc es exactamente la medianoche de Miami del lunes que abre la
  // ventana, así que su fecha de calendario es el cierre de la semana previa.
  const endDate = miamiCalendarParts(new Date(window.startUtc));
  const startDate = shiftMiamiDate(endDate, -7);

  return buildWindow(midnight(startDate), midnight(endDate));
}

function buildWindow(start, end) {
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    // Clave de idempotencia: el lunes de Miami en que abre la ventana. Estable
    // entre reintentos y legible en la tabla de entregas.
    periodKey: miamiDateKey(start),
    periodShort: formatPeriodShort(start, end),
    periodLong: formatPeriodLong(start, end)
  };
}

/** YYYY-MM-DD de un instante, en calendario de Miami. */
export function miamiDateKey(date) {
  const { year, month, day } = miamiCalendarParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * El domingo que se muestra es el último día CON datos, no el lunes exclusivo
 * con el que se consulta. Restar un milisegundo en vez de un día evita tener que
 * volver a razonar sobre el calendario.
 */
function lastIncludedDay(end) {
  return new Date(end.getTime() - 1);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** "Aug 10–16, 2026" — y con el mes repetido solo cuando cambia. */
function formatPeriodShort(start, end) {
  const a = miamiCalendarParts(start);
  const b = miamiCalendarParts(lastIncludedDay(end));

  if (a.year !== b.year) {
    return `${MONTHS_SHORT[a.month - 1]} ${a.day}, ${a.year} – ${MONTHS_SHORT[b.month - 1]} ${b.day}, ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${MONTHS_SHORT[a.month - 1]} ${a.day} – ${MONTHS_SHORT[b.month - 1]} ${b.day}, ${b.year}`;
  }
  return `${MONTHS_SHORT[a.month - 1]} ${a.day}–${b.day}, ${a.year}`;
}

/** "August 10–16, 2026", para el cuerpo del correo. */
function formatPeriodLong(start, end) {
  const a = miamiCalendarParts(start);
  const b = miamiCalendarParts(lastIncludedDay(end));

  if (a.year !== b.year) {
    return `${MONTHS_LONG[a.month - 1]} ${a.day}, ${a.year} – ${MONTHS_LONG[b.month - 1]} ${b.day}, ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${MONTHS_LONG[a.month - 1]} ${a.day} – ${MONTHS_LONG[b.month - 1]} ${b.day}, ${b.year}`;
  }
  return `${MONTHS_LONG[a.month - 1]} ${a.day}–${b.day}, ${a.year}`;
}

/**
 * El día de la semana (0=lunes … 6=domingo) y la franja horaria de Miami de un
 * `created_at`. La actividad diaria se reporta en hora local: un lead de las
 * 21:00 del domingo llega a D1 con fecha de lunes UTC, y contarlo como lunes
 * movería la fila al día equivocado del propio reporte.
 */
export function miamiDayAndBucket(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MIAMI_TZ,
    weekday: "short",
    hour: "2-digit",
    hour12: false
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;

  const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);

  return {
    dayIndex: WEEKDAYS[parts.weekday],
    hour,
    bucket: hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3
  };
}

export const MIAMI_TIMEZONE = MIAMI_TZ;
