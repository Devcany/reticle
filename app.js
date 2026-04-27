// Reticle — app.js
// Entry point. SW registration + app init + screen routing.

import { getAllArmies, getActiveArmyId, setActiveArmyId } from './storage.js';
import { showScreen, navigate } from './ui.js';
import { initSetupScreen } from './setup.js';
import { initImportScreen } from './import.js';
import { initManualScreen } from './manual.js';

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
function wireStaticListeners(manualCtrl) {
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
}

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

  const manualCtrl = initManualScreen(onManualDone);
  initSetupScreen(hasArmies, () => manualCtrl.reset());
  initImportScreen(onImportDone);
  wireStaticListeners(manualCtrl);

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
