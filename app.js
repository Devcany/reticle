// Reticle — app.js
// Entry point. SW registration + app init + screen routing.

import { getAllArmies, getActiveArmyId, setActiveArmyId, getArmy, saveArmy } from './storage.js';
import { showScreen, navigate, goBack } from './ui.js';
import { initSetupScreen } from './setup.js';
import { initImportScreen } from './import.js';
import { initManualScreen } from './manual.js';
import { initScanScreen } from './scan.js';
import { detectMarkers, markersToUnits } from './detector.js';

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((r) => console.log('[Reticle] SW registered:', r.scope))
      .catch((e) => console.error('[Reticle] SW failed:', e));
  });
}

// --- Home screen ---
function renderHome(army) {
  const titleEl = document.getElementById('home-title');
  const cardEl  = document.getElementById('home-army-card');

  if (titleEl) titleEl.textContent = army.name.toUpperCase();

  if (cardEl) {
    const unclear = army.units.filter((u) => u.status === 'unclear').length;
    cardEl.innerHTML = `
      <div class="home-stats">
        <div class="home-stat">
          <span class="home-stat-label">EINHEITEN</span>
          <span class="home-stat-value">${army.units.length}</span>
        </div>
        <div class="home-stat">
          <span class="home-stat-label">PUNKTE</span>
          <span class="home-stat-value">${army.totalPoints}</span>
        </div>
      </div>
      ${unclear > 0 ? `<p class="home-warn">${unclear} Eintrag${unclear !== 1 ? 'e' : ''} benoetigen Klaerung</p>` : ''}
      <ul class="home-unit-list">
        ${army.units.map((u) => `
          <li class="home-unit${u.status === 'unclear' ? ' home-unit--unclear' : ''}">
            <span class="home-unit-name">${u.name}</span>
            <span class="home-unit-meta">&times;${u.count}&nbsp;&middot;&nbsp;${u.points}&nbsp;Pkt.</span>
          </li>
        `).join('')}
      </ul>
      <a href="print.html?armyId=${army.id}" class="btn btn--outline btn--block btn--print">
        &#9634; Marker drucken
      </a>
    `;
  }
}

// --- List select screen ---
function renderListSelect(armies) {
  const container = document.getElementById('list-select-armies');
  if (!container) return;
  container.innerHTML = '';
  armies.forEach(async (army) => {
    const btn = document.createElement('button');
    btn.className = 'army-card';
    btn.innerHTML = `
      <span class="army-card-name">${army.name}</span>
      <span class="army-card-meta">${army.units.length} Einheiten &middot; ${army.totalPoints} Pkt.</span>
    `;
    btn.addEventListener('click', async () => {
      await setActiveArmyId(army.id);
      renderHome(army);
      navigate('screen-home');
    });
    container.appendChild(btn);
  });
}

// --- Static listeners (wired once) ---
function wireStaticListeners(manualCtrl, scanCtrl) {
  const listSelectNew = document.getElementById('list-select-new');
  if (listSelectNew) {
    listSelectNew.addEventListener('click', () => {
      manualCtrl.reset();
      navigate('screen-setup');
    });
  }

  const homeBack = document.getElementById('home-back');
  if (homeBack) {
    homeBack.addEventListener('click', async () => {
      const armies = await getAllArmies();
      if (armies.length > 1) {
        renderListSelect(armies);
        showScreen('screen-list-select');
      } else {
        showScreen('screen-setup');
      }
    });
  }

  // "Scan starten" Button auf dem Home-Screen
  const homeScanBtn = document.getElementById('home-scan-btn');
  if (homeScanBtn) {
    homeScanBtn.addEventListener('click', async () => {
      // ⚠️  iOS Safari: getUserMedia muss synchron im Gesture-Handler aufgerufen werden.
      // Kein await vor startCamera() — sonst verliert iOS den Gesture-Context und
      // zeigt den Permission-Dialog nicht.
      navigate('screen-scan');
      scanCtrl.startCamera();                          // getUserMedia wird HIER gefeuert

      // Erst NACH dem Camera-Start dürfen async-Calls folgen
      const activeId   = await getActiveArmyId();
      const armies     = await getAllArmies();
      const activeArmy = activeId ? armies.find((a) => a.id === activeId) : null;
      _scanArmy = activeArmy || null;                  // Detektor-Kontext setzen
      scanCtrl.setArmy(_scanArmy);                     // Label nachziehen
    });
  }
}

// ─── Aktive Armee für Scan-Kontext (wird beim Scan-Start gesetzt) ──────────
// Referenz bleibt bis zum nächsten Scan-Start aktuell.
let _scanArmy = null;

// --- Init ---
async function initApp() {
  const armies   = await getAllArmies();
  const hasArmies = armies.length > 0;

  function onImportDone(army) {
    renderHome(army);
    navigate('screen-home');
  }

  function onManualDone(army) {
    renderHome(army);
    navigate('screen-home');
  }

  // Scan-Screen: Erkennung + Mapping + UX-State-Machine
  const scanCtrl = initScanScreen({
    // ── Capture: Detektor laufen lassen, Ergebnis an Scan-Screen übergeben ──
    onCapture: (imageData) => {
      const markers = detectMarkers(imageData);
      const result  = markersToUnits(markers, _scanArmy);
      scanCtrl.showResult(result);              // P3c: State Machine
    },

    // ── Confirm: Einheit persistieren ──
    onConfirm: async ({ unitId, newCount }) => {
      if (!_scanArmy) return;
      const unit = _scanArmy.units.find((u) => u.id === unitId);
      if (!unit) return;

      unit.status    = 'active';
      unit.scannedAt = new Date().toISOString();
      if (newCount !== unit.count) unit.count = newCount;

      // totalPoints neu berechnen
      _scanArmy.totalPoints = _scanArmy.units.reduce((s, u) => s + (u.points || 0), 0);

      try {
        await saveArmy(_scanArmy);
      } catch (err) {
        console.error('[Reticle] saveArmy failed:', err);
      }
    },
    onBack: async () => {
      // Stream ist bereits gestoppt (scan.js ruft stopCamera vor onBack)
      const armies     = await getAllArmies();
      const activeId   = await getActiveArmyId();
      const activeArmy = activeId ? armies.find((a) => a.id === activeId) : null;
      if (activeArmy) {
        renderHome(activeArmy);
        showScreen('screen-home');
      } else {
        goBack('screen-home');
      }
    },
  });

  const manualCtrl = initManualScreen(onManualDone);
  initSetupScreen(hasArmies, () => manualCtrl.reset());
  initImportScreen(onImportDone);
  wireStaticListeners(manualCtrl, scanCtrl);

  // Determine start screen
  const activeId    = await getActiveArmyId();
  const activeArmy  = activeId ? armies.find((a) => a.id === activeId) : null;

  if (armies.length === 0) {
    showScreen('screen-setup');
  } else if (activeArmy) {
    renderHome(activeArmy);
    showScreen('screen-home');
  } else if (armies.length === 1) {
    await setActiveArmyId(armies[0].id);
    renderHome(armies[0]);
    showScreen('screen-home');
  } else {
    renderListSelect(armies);
    showScreen('screen-list-select');
  }
}

initApp().catch((err) => console.error('[Reticle] init failed:', err));
