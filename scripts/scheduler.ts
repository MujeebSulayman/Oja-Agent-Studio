// Local scheduler: pings /api/cron every minute so scheduled agents run.
//   npm run scheduler
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

async function tick() {
  try {
    const res = await fetch(`${base}/api/cron`, { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {} });
    const json = (await res.json()) as { ran?: Array<{ name: string; ok: boolean }>; error?: string };
    if (json.error) console.error(new Date().toISOString(), json.error);
    for (const r of json.ran ?? []) console.log(new Date().toISOString(), `ran ${r.name}: ${r.ok ? "ok" : "failed"}`);
  } catch (e) {
    console.error(new Date().toISOString(), "scheduler could not reach the app:", (e as Error).message);
  }
}

console.log(`Scheduler running against ${base}. Checking every 60s.`);
void tick();
setInterval(tick, 60_000);
