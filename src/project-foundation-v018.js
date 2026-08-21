import { CAMPUS } from './config.js';
import { FACULTY_IDS } from './faculty-registry-v017.js';

export const PROJECT = Object.freeze({
  version: 'v0.18.0',
  codename: 'TERRAIN-AWARE FOUNDATIONS + AGGRESSIVE STABILIZATION',
  purpose: 'Una cota de planta por edificio derivada de toda su huella; terreno, interiores, fachadas y colisiones dejan de usar criterios verticales independientes.',
  featureFreeze: true,
  targetFps: 60,
  minimumHealthyFps: 45,
  activeReconstruction: 'building-foundation-v018'
});

export function installProjectMetadata() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.espolBuilderVersion = PROJECT.version;
  document.body?.setAttribute('data-project-phase', PROJECT.codename);
  globalThis.__ESPOL_PROJECT__ = { PROJECT, FACULTY_IDS };

  const badge = document.querySelector('.topbar .badge');
  if (badge) badge.textContent = `${PROJECT.version} · TERRAIN FOUNDATIONS · STABILITY`;

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

  if (!(CAMPUS.avatarHeightM >= 1.5 && CAMPUS.avatarHeightM <= 2.1)) {
    remember('foundation', `avatar-scale-invalid:${CAMPUS.avatarHeightM}`);
  }
}
