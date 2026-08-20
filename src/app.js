// Compatibility entrypoint for cached GitHub Pages HTML.
// The application now lives in runtime.js.
import './runtime.js';

// GameWorld keeps a small set of global input listeners for jump/jetpack.
// Stop gameplay-only keys during GIS map mode so returning to the game cannot
// inherit a queued jump/jetpack action from the map screen.
document.addEventListener('keydown', event => {
  if (document.body.classList.contains('map-mode') && ['Space', 'KeyF'].includes(event.code)) {
    event.stopImmediatePropagation();
  }
}, true);
