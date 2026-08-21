// Stable entrypoint for GitHub Pages.
// Install the exact FIMCP parking respawn before modules evaluate CAMPUS-derived constants.
await import('./spawn-fimcp-v015.js');

// v0.18 metadata/error capture must exist before GIS/game systems boot.
const { installProjectMetadata } = await import('./project-foundation-v018.js');
installProjectMetadata();

// Building footprints must be captured before runtime.js creates MapLibre.
await import('./building-sync-preload.js');

// Stop gameplay-only keys while GIS Map mode owns the keyboard so returning to
// the 3D runtime cannot inherit a queued jump, jetpack or flashlight action.
document.addEventListener('keydown', event => {
  if (document.body.classList.contains('map-mode') && ['Space', 'KeyF'].includes(event.code)) event.stopImmediatePropagation();
}, true);

await import('./runtime.js');
