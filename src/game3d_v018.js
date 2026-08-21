import { createGameWorld as createV017World } from './game3d_v017.js';
import {
  buildFoundationModel, runWithFoundationCenters, installFoundationSkirts,
  installWalkSurface, auditBuildingFoundations
} from './building-foundation-v018.js';
import { prepareStructureReloadV0181, installRuntimeStabilityV0181 } from './stability-v0181.js';

function publish(report) {
  globalThis.__ESPOL_BUILDING_FOUNDATION_REPORT__ = report;
  if (typeof dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    dispatchEvent(new CustomEvent('espol:building-foundation-audit', { detail: report }));
  }
}

export async function createGameWorld(options) {
  const world = await createV017World(options);
  const v017SetStructures = world.setStructures.bind(world);
  // Capture the real GameWorld toggle before campus architecture starts wrapping it.
  // Reusing this one function prevents a new wrapper chain on every structure scan.
  const baseBuildingToggle = world.setBuildingsEnabled.bind(world);

  world.setStructures = structures => {
    prepareStructureReloadV0181(world);

    // Build the elevation model BEFORE v0.17 creates any building geometry.
    // During that one installation call, center-height queries resolve to the
    // finished-floor elevation sampled from the whole footprint.
    const model = buildFoundationModel(world, structures || {});
    runWithFoundationCenters(world, model, () => v017SetStructures(structures));

    installFoundationSkirts(world, model);
    installWalkSurface(world, model);
    installRuntimeStabilityV0181(world, { baseBuildingToggle });

    const report = auditBuildingFoundations(world, model);
    world.buildingFoundationAudit = report;
    publish(report);
    if (!report.ok) {
      const message = `Building foundation audit failed: ${report.hardErrors.join(', ')}`;
      console.error(message, report);
      throw new Error(message);
    }
    if (report.warnings.length) console.warn('v0.18.1 building foundation audit: degraded', report);
    else console.info('v0.18.1 building foundation audit: OK', report);
  };

  world.getBuildingFoundationReport = () => world.buildingFoundationAudit || null;
  world.getRuntimeStabilityReport = () => world.runtimeStabilityReport || null;
  return world;
}
