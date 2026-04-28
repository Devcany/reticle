// Reticle — validator.js
// Pure validation function. No side effects, no DOM manipulation.
// Input: raw parsed JSON object.
// Output: { army | null, problems: string[], unclear: number, skipped: number }

export function validateArmy(raw) {
  const problems = [];
  const now = new Date().toISOString();

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { army: null, problems: ['Ungueltige Datei: kein JSON-Objekt.'], unclear: 0, skipped: 0 };
  }

  if (!raw.units || !Array.isArray(raw.units) || raw.units.length === 0) {
    return { army: null, problems: ['Keine Einheiten gefunden.'], unclear: 0, skipped: 0 };
  }

  const army = {
    schemaVersion: '1.0',
    id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : `army-${Date.now()}`,
    name: (typeof raw.name === 'string' && raw.name.trim()) ? raw.name.trim() : `Army ${Date.now()}`,
    createdAt: (typeof raw.createdAt === 'string') ? raw.createdAt : now,
    updatedAt: now,
    units: [],
    totalPoints: 0,
  };

  let skipped = 0;
  let unclear = 0;
  let seq = 1;

  for (const u of raw.units) {
    const rawName = typeof u.name === 'string' ? u.name.trim() : '';

    // Empty name: discard entry entirely
    if (!rawName) {
      skipped++;
      continue;
    }

    const unit = {
      id: (typeof u.id === 'string' && u.id.trim()) ? u.id.trim() : `unit-${String(seq).padStart(3, '0')}`,
      name: rawName.slice(0, 100),
      count: 1,
      maxCount: 1,   // P4: Soll-Stärke — wird beim Anlegen gesetzt, nie überschrieben
      points: 0,
      status: 'active',
      scannedAt: null,
    };

    let unitUnclear = false;

    // Validate count
    if (u.count !== undefined && u.count !== null) {
      const count = Number(u.count);
      if (!Number.isInteger(count) || count < 1) {
        problems.push(`"${unit.name}": Modellanzahl ungueltig (${u.count}), auf 1 gesetzt.`);
        unitUnclear = true;
      } else {
        unit.count    = count;
        unit.maxCount = count;   // P4: Soll-Stärke = importierter Wert
      }
    } else {
      problems.push(`"${unit.name}": Modellanzahl fehlt, auf 1 gesetzt.`);
      unitUnclear = true;
    }

    // Validate points
    const ptsRaw = u.points;
    if (ptsRaw !== undefined && ptsRaw !== null && ptsRaw !== '') {
      const pts = Number(ptsRaw);
      if (!Number.isInteger(pts) || pts < 0) {
        problems.push(`"${unit.name}": Punkte ungueltig (${ptsRaw}), auf 0 gesetzt.`);
        unitUnclear = true;
      } else {
        unit.points = pts;
      }
    } else {
      problems.push(`"${unit.name}": Punkte fehlen, auf 0 gesetzt.`);
      unitUnclear = true;
    }

    if (unitUnclear) {
      unit.status = 'unclear';
      unclear++;
    }

    army.units.push(unit);
    seq++;
  }

  if (skipped > 0) {
    problems.push(`${skipped} Zeile(n) uebersprungen (kein Einheitenname).`);
  }

  if (army.units.length === 0) {
    return { army: null, problems: ['Keine gueltigen Einheiten gefunden.', ...problems], unclear: 0, skipped };
  }

  army.totalPoints = army.units.reduce((sum, u) => sum + u.points, 0);

  return { army, problems, unclear, skipped };
}
