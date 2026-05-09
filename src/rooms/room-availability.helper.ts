export type BusyInterval = { checkIn: Date; checkOut: Date };

export function wireLocalToDate(wire: string): Date {
  const m = wire.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(NaN);
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0,
  );
}

export function formatWireYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatWireDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

/** Standard placeholder stay: arrive 14:00, leave next day 12:00 (matches admin defaults). */
export function defaultStayForDay(ymd: string): { checkIn: Date; checkOut: Date } {
  const checkIn = wireLocalToDate(`${ymd}T14:00`);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 1);
  checkOut.setHours(12, 0, 0, 0);
  return { checkIn, checkOut };
}

export function intervalOverlaps(
  aIn: Date,
  aOut: Date,
  busy: BusyInterval[],
): boolean {
  return busy.some((b) => b.checkIn < aOut && b.checkOut > aIn);
}

export function parseRangeInclusive(
  fromYmd: string,
  toYmd: string,
): { start: Date; end: Date } | null {
  const fs = `${fromYmd}T00:00:00`;
  const ts = `${toYmd}T23:59:59`;
  const start = wireLocalToDate(fs);
  const end = wireLocalToDate(ts);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start > end) return null;
  return { start, end };
}
