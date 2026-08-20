import { CAMPUS } from './config.js';

const select = document.querySelector('#gameMode');
const body = document.body;
const hint = document.querySelector('#modeActionHint');
const sprintLegend = document.querySelector('#sprintLegend');

function applyMode() {
  const mode = select?.value || 'explore';
  CAMPUS.sprintMultiplier = mode === 'explore' ? 10 : 2.5;
  body.dataset.gameMode = mode;
  if (sprintLegend) sprintLegend.textContent = mode === 'explore' ? 'sprint ×10' : 'sprint ×2.5';
  if (hint) {
    hint.textContent = mode === 'shooter'
      ? 'Shooter: clic izquierdo = disparar · cámara sobre hombro'
      : mode === 'horror'
        ? 'Terror: linterna activa · F = encender/apagar'
        : mode === 'rpg'
          ? 'RPG: mantén Espacio = jetpack · suelta para descender'
          : 'Exploración: Espacio = saltar · Shift = velocidad ×10';
  }
}

select?.addEventListener('change', applyMode);
applyMode();

// app.js actualiza el HUD cada ~100 ms con una etiqueta fija. Este pequeño
// observador corrige sólo el texto visible; la velocidad real ya usa el objeto
// CAMPUS compartido entre módulos.
const pace = document.querySelector('#pace');
if (pace) {
  new MutationObserver(() => {
    if ((select?.value || 'explore') === 'explore' && pace.textContent.startsWith('Sprint')) pace.textContent = 'Sprint ×10';
  }).observe(pace, { childList: true, characterData: true, subtree: true });
}
