export const GAME_MODES = Object.freeze({
  explore: Object.freeze({
    id: 'explore',
    label: 'Exploración',
    sprintMultiplier: 5,
    bodyClass: null,
    hint: 'Exploración: Espacio = saltar · Shift = velocidad ×5'
  }),
  horror: Object.freeze({
    id: 'horror',
    label: 'Terror nocturno',
    sprintMultiplier: 2.5,
    bodyClass: 'mode-horror',
    hint: 'Terror: linterna frontal · F = encender/apagar'
  }),
  rpg: Object.freeze({
    id: 'rpg',
    label: 'RPG',
    sprintMultiplier: 2.5,
    bodyClass: 'mode-rpg',
    hint: 'RPG: mantén Espacio = jetpack · suelta para descender'
  }),
  shooter: Object.freeze({
    id: 'shooter',
    label: 'Shooter sandbox',
    sprintMultiplier: 2.5,
    bodyClass: 'mode-shooter',
    hint: 'Shooter: clic izquierdo = disparar · cámara sobre hombro'
  })
});

export const MODE_IDS = Object.freeze(Object.keys(GAME_MODES));

export function getModeConfig(mode) {
  return GAME_MODES[mode] || GAME_MODES.explore;
}

export function isGameMode(mode) {
  return Object.prototype.hasOwnProperty.call(GAME_MODES, mode);
}
