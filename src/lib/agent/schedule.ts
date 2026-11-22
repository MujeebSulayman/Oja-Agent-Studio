// Schedules are stored as "off", "hourly" or "daily@HH:MM" (Lagos time).

export const TIMEZONE = process.env.OJA_TIMEZONE ?? "Africa/Lagos";

function localParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isDue(schedule: string, lastRunAt: number | null, now = Date.now()): boolean {
  if (schedule === "hourly") return !lastRunAt || now - lastRunAt >= 60 * 60 * 1000 - 30_000;
  const m = schedule.match(/^daily@(\d{2}):(\d{2})$/);
  if (!m) return false;
  const target = Number(m[1]) * 60 + Number(m[2]);
  const today = localParts(now);
  if (today.minutes < target) return false;
  return !lastRunAt || localParts(lastRunAt).date !== today.date || localParts(lastRunAt).minutes < target;
}

export function describeSchedule(schedule: string): string {
  if (schedule === "hourly") return "Every hour";
  const m = schedule.match(/^daily@(\d{2}:\d{2})$/);
  return m ? `Every day at ${m[1]}` : "Only when you chat";
}
