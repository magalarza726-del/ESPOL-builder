import { CAMPUS } from './config.js';
import { FACULTY_IDS } from './faculty-registry-v017.js';

export const PROJECT = Object.freeze({
  version: 'v0.18.1',
  codename: 'AGGRESSIVE BUGFIX + TERRAIN FOUNDATION STABILITY',
  purpose: 'Eliminar edificios duplicados, pisos invisibles, recargas con modelos obsoletos, Rectorado duplicado y colisiones forestales incoherentes.',
  featureFreeze: true,
  targetFps: 60,
  minimumHealthyFps: 45,
  activeReconstruction: 'stability-v0181'
});

export function installProjectMetadata() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.espolBuilderVersion = PROJECT.version;
  document.body?.setAttribute('data-project-phase', PROJECT.codename);
  globalThis.__ESPOL_PROJECT__ = { PROJECT, FACULTY_IDS };

  const badge = document.querySelector('.topbar .badge');
  if (badge) badge.textContent = `${PROJECT.version} · BUGFIX · TERRAIN/BUILDINGS/FOREST`;

  const buffer = globalThis.__ESPOL_RUNTIME_ERRORS__ ||= [];
  const remember = (type, payload) => {
    buffer.push({ type, payload: String(payload?.message || payload || 'unknown'), at: new Date().toISOString() });
    if (buffer.length > 60) buffer.splice(0, buffer.length - 60);
  };
  addEventListener('error', event => remember('error', event.error || event.message));
  addEventListener('unhandledrejection', event => remember('unhandledrejection', event.reason));

  addEventListener('espol:foundation-audit', event => {
    const report = event.detail;
    const state = !report?.ok ? 'failed' : report.degraded ? 'degraded' : 'ok';
    document.body.dataset.foundationState = state;
  });
  addEventListener('espol:building-foundation-audit', event => {
    const report = event.detail;
    const state = !report?.ok ? 'failed' : report.degraded ? 'degraded' : 'ok';
    document.body.dataset.buildingFoundationState = state;
    if (badge) {
      badge.dataset.foundationState = state;
      badge.title = report?.warnings?.length
        ? `Building foundations: ${state} · ${report.warnings.slice(0, 5).join(', ')}`
        : `Building foundations: ${state}`;
    }
  });

  // runtime.js is kept as a stable core; normalize only its legacy version prefix
  // at the presentation boundary instead of forking hundreds of lines of runtime.
  const toast = document.querySelector('#toast');
  if (toast && typeof MutationObserver !== 'undefined') {
    const normalizeRuntimeVersion = () => {
      const text = toast.textContent || '';
      if (/^v0\.\d+\.\d+/.test(text) && !text.startsWith(PROJECT.version)) {
        toast.textContent = text.replace(/^v0\.\d+\.\d+/, PROJECT.version);
      }
    };
    new MutationObserver(normalizeRuntimeVersion).observe(toast, { childList: true, characterData: true, subtree: true });
  }

  if (!(CAMPUS.avatarHeightM >= 1.5 && CAMPUS.avatarHeightM <= 2.1)) {
    remember('foundation', `avatar-scale-invalid:${CAMPUS.avatarHeightM}`);
  }
}
