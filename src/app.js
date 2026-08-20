// Compatibility entrypoint for GitHub Pages.
// v0.10 preloads the MapLibre building capture BEFORE runtime.js creates the map.
await import('./building-sync-preload.js');

// GameWorld keeps a small set of global input listeners for jump/jetpack.
// Stop gameplay-only keys during GIS map mode so returning to the game cannot
// inherit a queued jump/jetpack action from the map screen.
document.addEventListener('keydown', event => {
  if (document.body.classList.contains('map-mode') && ['Space', 'KeyF'].includes(event.code)) {
    event.stopImmediatePropagation();
  }
}, true);

await import('./runtime.js');
