import { CAMPUS } from './config.js';

const select = document.querySelector('#gameMode');
const body = document.body;
const hint = document.querySelector('#modeActionHint');
const sprintLegend = document.querySelector('#sprintLegend');

function applyMode() {
  const mode = select?.value || 'explore';
  CAMPUS.sprintMultiplier = mode === 'explore' ? 5 : 2.5;
  body.dataset.gameMode = mode;
  if (mode !== 'horror') body.classList.remove('flashlight-off');
  if (sprintLegend) sprintLegend.textContent = mode === 'explore' ? 'sprint ×5' : 'sprint ×2.5';
  if (hint) {
    hint.textContent = mode === 'shooter'
      ? 'Shooter: clic izquierdo = disparar · cámara sobre hombro'
      : mode === 'horror'
        ? 'Terror: linterna frontal · F = encender/apagar'
        : mode === 'rpg'
          ? 'RPG: mantén Espacio = jetpack · suelta para descender'
          : 'Exploración: Espacio = saltar · Shift = velocidad ×5';
  }
}

select?.addEventListener('change', applyMode);
applyMode();

// Sincroniza el efecto visual de linterna con el interruptor F del motor 3D.
window.addEventListener('keydown', e => {
  if (e.code === 'KeyF' && !e.repeat && (select?.value || 'explore') === 'horror') {
    body.classList.toggle('flashlight-off');
  }
});

// app.js actualiza el HUD cada ~100 ms con una etiqueta fija. Este observador
// corrige sólo el texto visible; la velocidad real usa el objeto CAMPUS compartido.
const pace = document.querySelector('#pace');
if (pace) {
  new MutationObserver(() => {
    if ((select?.value || 'explore') === 'explore' && pace.textContent.startsWith('Sprint')) {
      pace.textContent = 'Sprint ×5';
    }
  }).observe(pace, { childList: true, characterData: true, subtree: true });
}
