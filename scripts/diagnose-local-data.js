/**
 * What is actually stored on this device?
 *
 * Paste into the browser console at the origin you use the app on
 * (e.g. http://localhost:5173). Read-only — writes nothing.
 */
(() => {
  const db = JSON.parse(localStorage.getItem('foodlog_db_v1') || 'null');
  const line = () => console.log('-'.repeat(58));

  line();
  console.log('  LOCAL DATA REPORT —', location.origin);
  line();

  if (!db) {
    console.log('  No local database yet. Open the app once, then re-run.');
    return;
  }

  const logs = db.logs || [];
  const days = [...new Set(logs.map((l) => l.date))].sort();

  console.log('  Food entries stored :', logs.length);
  console.log('  Distinct days       :', days.length);
  console.log('  Date range          :', days.length ? `${days[0]}  →  ${days[days.length - 1]}` : '—');
  console.log('  Chat days kept      :', Object.keys(db.chat || {}).length);
  console.log('  Daily goal          :', db.goals?.calories, 'kcal');

  const m = db.meta?.migration || {};
  line();
  console.log('  MIGRATION');
  console.log('  status   :', m.status, '| source:', m.source, '| attempts:', m.attempts);
  console.log('  imported :', m.importedLogs, 'entries,', m.importedChatDays, 'chat days');
  if (m.lastError) console.log('  error    :', m.lastError);

  line();
  console.log('  LEGACY KEYS STILL ON THIS DEVICE (your backup)');
  const legacy = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (/^sb-.+-auth-token$/.test(k) || k.startsWith('food_logs_local_') || k.startsWith('chat_messages_')) {
      let count = '';
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v)) count = ` (${v.length} items)`;
      } catch { /* not an array */ }
      legacy.push(k + count);
    }
  }
  console.log(legacy.length ? legacy.map((k) => '   • ' + k).join('\n') : '   (none)');

  line();
  if (logs.length > 0) {
    console.log('  Per-day totals:');
    for (const d of days.slice(-14)) {
      const dayLogs = logs.filter((l) => l.date === d);
      const kcal = dayLogs.reduce((a, l) => a + (l.calories || 0), 0);
      console.log(`   ${d}   ${String(dayLogs.length).padStart(2)} item(s)   ${kcal} kcal`);
    }
  } else {
    console.log('  Nothing logged locally yet — history will be empty until you log a meal.');
  }
  line();

  return { entries: logs.length, days: days.length, migration: m, legacyKeys: legacy };
})();
