/**
 * Migration verification — run against YOUR real data.
 *
 * The automated tests verify the migration's logic against synthetic data. This
 * script verifies the actual outcome on a real device: it re-reads your history
 * from Supabase and compares it, field by field, against what is now in local
 * storage.
 *
 * HOW TO RUN
 *   1. Open the app in the browser whose data you want to check.
 *   2. Open DevTools -> Console.
 *   3. Paste this entire file and press Enter.
 *
 * It is READ-ONLY. It writes nothing, to either store.
 *
 * If the session has expired and cannot refresh, set ANON_KEY below to your
 * project's anon key (Supabase dashboard -> Settings -> API) and re-run.
 */
(async () => {
  const ANON_KEY = null;   // optional override
  const PROJECT_URL = null; // optional override, e.g. 'https://xxxx.supabase.co'

  const DB_KEY = 'foodlog_db_v1';
  const PAGE = 1000;
  const log = (...a) => console.log(...a);
  const rule = (c = '-') => log(c.repeat(70));

  // ---------------------------------------------------------------- local
  let db;
  try {
    db = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
  } catch {
    return log('FAIL: local database exists but is not valid JSON.');
  }
  if (!db) return log(`FAIL: no local database found under "${DB_KEY}". Open the app first.`);

  const localLogs = Array.isArray(db.logs) ? db.logs : [];
  const migration = db.meta?.migration ?? {};

  // -------------------------------------------------------------- session
  let sessionKey = null;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && /^sb-.+-auth-token$/.test(k)) sessionKey = k;
  }
  if (!sessionKey) {
    log('No legacy Supabase session found on this device.');
    log('Nothing can be compared against — but that also means there was nothing');
    log(`to migrate here. Local records: ${localLogs.length}.`);
    return;
  }

  let raw = localStorage.getItem(sessionKey);
  if (raw && raw.startsWith('base64-')) raw = atob(raw.slice(7));
  const session = (() => { try { const p = JSON.parse(raw); return p.currentSession ?? p; } catch { return null; } })();
  if (!session?.access_token) return log('FAIL: legacy session is unreadable.');

  const ref = sessionKey.match(/^sb-(.+)-auth-token$/)[1];
  const baseUrl = (PROJECT_URL || `https://${ref}.supabase.co`).replace(/\/$/, '');
  const apiKey = ANON_KEY || session.access_token;

  let token = session.access_token;
  const expired = session.expires_at && session.expires_at * 1000 <= Date.now() + 60000;
  if (expired && session.refresh_token) {
    try {
      const r = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (r.ok) token = (await r.json()).access_token || token;
    } catch { /* fall through and let the read fail loudly */ }
  }

  // ------------------------------------------------------------- fetch all
  const remote = [];
  for (let page = 0; page < 100; page++) {
    const url = `${baseUrl}/rest/v1/food_logs?select=*&order=created_at.asc&limit=${PAGE}&offset=${page * PAGE}`;
    let res;
    try {
      res = await fetch(url, { headers: { apikey: apiKey, Authorization: `Bearer ${token}` } });
    } catch (e) {
      return log('FAIL: could not reach Supabase.', e);
    }
    if (!res.ok) {
      log(`FAIL: Supabase returned ${res.status}. ${res.status === 401
        ? 'The session expired — set ANON_KEY at the top of this script and re-run.'
        : ''}`);
      return;
    }
    const batch = await res.json();
    remote.push(...batch);
    if (batch.length < PAGE) break;
  }

  // ------------------------------------------------------------- compare
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayOf = (r) => (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    ? r.date : isoDay(new Date(r.created_at));
  const n = (v) => { const p = typeof v === 'number' ? v : parseFloat(String(v ?? 0)); return Number.isFinite(p) ? p : 0; };

  const localById = new Map();
  const dupIds = [];
  for (const r of localLogs) {
    if (localById.has(r.id)) dupIds.push(r.id);
    else localById.set(r.id, r);
  }

  const missing = [];
  const mismatches = [];
  const FIELDS = [
    ['name', (r) => (typeof r.name === 'string' ? r.name : 'Unknown'), (l) => l.name],
    ['quantity', (r) => n(r.quantity), (l) => n(l.quantity)],
    ['unit', (r) => (typeof r.unit === 'string' ? r.unit : 'serving'), (l) => l.unit],
    ['calories', (r) => n(r.calories), (l) => n(l.calories)],
    ['protein', (r) => n(r.protein), (l) => n(l.protein)],
    ['carbs', (r) => n(r.carbs), (l) => n(l.carbs)],
    ['fats', (r) => n(r.fats ?? r.fat), (l) => n(l.fats)],
    ['sugar', (r) => n(r.sugar), (l) => n(l.sugar)],
    ['fiber', (r) => n(r.fiber), (l) => n(l.fiber)],
    ['createdAt', (r) => r.created_at, (l) => l.createdAt],
    ['date', (r) => dayOf(r), (l) => l.date],
  ];

  for (const r of remote) {
    const l = localById.get(r.id);
    if (!l) { missing.push(r.id); continue; }
    for (const [field, fromRemote, fromLocal] of FIELDS) {
      const a = fromRemote(r), b = fromLocal(l);
      if (a !== b) mismatches.push({ id: r.id, field, supabase: a, local: b });
    }
  }

  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = localLogs.filter((l) => !remoteIds.has(l.id)).map((l) => l.id);

  // Per-day totals, summed in the same order on both sides.
  const dayKeys = [...new Set(remote.map(dayOf))].sort();
  const dayDiffs = [];
  for (const day of dayKeys) {
    const rSide = remote.filter((r) => dayOf(r) === day)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const lSide = localLogs.filter((l) => l.date === day)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const sum = (arr, pick) => arr.reduce((s, x) => s + n(pick(x)), 0);
    const r1 = (v) => Math.round(v * 10) / 10;
    const a = {
      count: rSide.length, cal: sum(rSide, (x) => x.calories),
      p: r1(sum(rSide, (x) => x.protein)), c: r1(sum(rSide, (x) => x.carbs)),
      f: r1(sum(rSide, (x) => x.fats ?? x.fat)), s: r1(sum(rSide, (x) => x.sugar)),
      fi: r1(sum(rSide, (x) => x.fiber)),
    };
    const b = {
      count: lSide.length, cal: sum(lSide, (x) => x.calories),
      p: r1(sum(lSide, (x) => x.protein)), c: r1(sum(lSide, (x) => x.carbs)),
      f: r1(sum(lSide, (x) => x.fats)), s: r1(sum(lSide, (x) => x.sugar)),
      fi: r1(sum(lSide, (x) => x.fiber)),
    };
    if (JSON.stringify(a) !== JSON.stringify(b)) dayDiffs.push({ day, supabase: a, local: b });
  }

  // Calendar + statistics, using the ORIGINAL algorithms on both sides.
  const calDiffs = [];
  for (const month of [...new Set(dayKeys.map((d) => d.slice(0, 7)))].sort()) {
    const A = [...new Set(dayKeys.filter((d) => d.startsWith(month)))].sort().join(',');
    const B = [...new Set(localLogs.map((l) => l.date).filter((d) => d && d.startsWith(month)))].sort().join(',');
    if (A !== B) calDiffs.push({ month, supabase: A, local: B });
  }

  const streakOf = (days) => {
    const set = new Set(days);
    const today = isoDay(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    let cur = set.has(today) ? new Date() : set.has(isoDay(y)) ? y : null;
    let s = 0;
    while (cur && set.has(isoDay(cur))) { s++; cur.setDate(cur.getDate() - 1); }
    return s;
  };
  const weekly = (rows, pickDay, pickCal) => {
    const list = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); list.push(isoDay(d)); }
    const by = {};
    rows.forEach((r) => { const d = pickDay(r); if (list.includes(d)) by[d] = (by[d] || 0) + n(pickCal(r)); });
    const graph = list.map((d) => ({ date: d, calories: Math.round(by[d] || 0) }));
    return { graph, avg: Math.round(graph.reduce((s, g) => s + g.calories, 0) / 7) };
  };

  const sBefore = streakOf(remote.map(dayOf));
  const sAfter = streakOf(localLogs.map((l) => l.date));
  const wBefore = weekly(remote, dayOf, (r) => r.calories);
  const wAfter = weekly(localLogs, (l) => l.date, (l) => l.calories);

  // -------------------------------------------------------------- report
  console.log('\n');
  rule('=');
  log('  MIGRATION VERIFICATION — this device, real data');
  rule('=');
  log(`  Supabase project     ${ref}`);
  log(`  Migration status     ${migration.status ?? 'unknown'} (source: ${migration.source ?? '?'}, attempts: ${migration.attempts ?? 0})`);
  if (migration.lastError) log(`  Last error           ${migration.lastError}`);
  rule();
  log('  RECORD COUNTS');
  rule();
  log(`    In Supabase                      ${remote.length}`);
  log(`    In local storage                 ${localLogs.length}`);
  log(`      ...of which came from Supabase ${localLogs.length - localOnly.length}`);
  log(`      ...created since / local-only  ${localOnly.length}`);
  rule();
  log('  INTEGRITY');
  rule();
  log(`    Missing records        ${missing.length}${missing.length ? '  ' + missing.slice(0, 10).join(', ') : ''}`);
  log(`    Duplicate IDs          ${dupIds.length}${dupIds.length ? '  ' + dupIds.slice(0, 10).join(', ') : ''}`);
  log(`    Field mismatches       ${mismatches.length}`);
  if (mismatches.length) console.table(mismatches.slice(0, 30));
  rule();
  log('  DERIVED DATA');
  rule();
  log(`    Per-day totals         ${dayDiffs.length === 0 ? 'IDENTICAL' : dayDiffs.length + ' day(s) differ'}   (${dayKeys.length} days)`);
  if (dayDiffs.length) console.table(dayDiffs.slice(0, 20));
  log(`    Calendar history       ${calDiffs.length === 0 ? 'IDENTICAL' : calDiffs.length + ' month(s) differ'}`);
  if (calDiffs.length) console.table(calDiffs);
  log(`    Streak                 before ${sBefore}  after ${sAfter}   ${sBefore === sAfter ? 'IDENTICAL' : 'DIFFERS'}`);
  log(`    Weekly average         before ${wBefore.avg}  after ${wAfter.avg}   ${wBefore.avg === wAfter.avg ? 'IDENTICAL' : 'DIFFERS'}`);
  log(`    7-day chart            ${JSON.stringify(wBefore.graph) === JSON.stringify(wAfter.graph) ? 'IDENTICAL' : 'DIFFERS'}`);
  rule('=');

  const problems = missing.length + dupIds.length + mismatches.length + dayDiffs.length +
    calDiffs.length + (sBefore !== sAfter ? 1 : 0) + (wBefore.avg !== wAfter.avg ? 1 : 0);

  if (problems === 0) {
    log('  RESULT: PASS — every Supabase record is present locally and identical.');
    log('  Your cloud data is still untouched; nothing was deleted.');
  } else {
    log(`  RESULT: ${problems} problem(s) found — see the tables above.`);
    log('  Your Supabase data has NOT been modified. To retry the import, run:');
    log("    (()=>{const d=JSON.parse(localStorage.foodlog_db_v1);" +
        "d.meta.migration={status:'pending',source:'none',attempts:0," +
        "importedLogs:0,importedChatDays:0,legacyKeys:[]};" +
        "localStorage.foodlog_db_v1=JSON.stringify(d);location.reload();})()");
  }
  rule('=');

  return { remote: remote.length, local: localLogs.length, missing, dupIds, mismatches, dayDiffs, calDiffs };
})();
