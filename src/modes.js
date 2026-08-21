const harness = config => Object.freeze({
  role: 'test-harness',
  affectsWorldData: false,
  ...config
});

// Only two user-facing presets remain. Their keys intentionally reuse the
// stable engine controllers: rpg = jetpack physics, shooter = weapon/aim.
// Presentation IDs can differ from engine IDs so runtime.js can still apply
// night-only flashlight UI without reintroducing four public modes.
export const GAME_MODES = Object.freeze({
  rpg: harness({
    id: 'day',
    engineId: 'rpg',
    label: 'Día',
    sprintMultiplier: 5,
    bodyClass: 'mode-day',
    hint: 'Día: Shift = velocidad ×5 · mantén Espacio = jetpack'
  }),
  shooter: harness({
    id: 'horror',
    engineId: 'shooter',
    label: 'Noche',
    sprintMultiplier: 2.5,
    bodyClass: 'mode-horror',
    hint: 'Noche: F = linterna · clic izquierdo = pistola'
  })
});

export const MODE_IDS = Object.freeze(Object.keys(GAME_MODES));

export function getModeConfig(mode) {
  return GAME_MODES[mode] || GAME_MODES.rpg;
}

export function isGameMode(mode) {
  return Object.prototype.hasOwnProperty.call(GAME_MODES, mode);
}
