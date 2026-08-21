import { createGameWorld as createV017World } from './game3d_v017.js';
import {
  buildFoundationModel, runWithFoundationCenters, installFoundationSkirts,
  installWalkSurface, auditBuildingFoundations
} from './building-foundation-v018.js';

function publish(report) {
  globalThis.__ESPOL_BUILDING_FOUNDATION_REPORT__ = report;
  if (typeof dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    dispatchEvent(new CustomEvent('espol:building-foundation-audit', { detail: report }));
  }
}

export async function createGameWorld(options) {
  const world = await createV017World(options);
  const v017SetStructures = world.setStructures.bind(world);

  world.setStructures = structures => {
    // Build the elevation model BEFORE v0.17 creates any building geometry.
    // During that one installation call, center-height queries resolve to the
    // finished-floor elevation sampled from the whole footprint.
    const model = buildFoundationModel(world, structures || {});
    runWithFoundationCenters(world, model, () => v017SetStructures(structures));

    installFoundationSkirts(world, model);
    installWalkSurface(world, model);

    const report = auditBuildingFoundations(world, model);
    world.buildingFoundationAudit = report;
    publish(report);
    if (!report.ok) {
      const message = `Building foundation audit failed: ${report.hardErrors.join(', ')}`;
      console.error(message, report);
      throw new Error(message);
    }
    if (report.warnings.length) console.warn('v0.18 building foundation audit: degraded', report);
    else console.info('v0.18 building foundation audit: OK', report);
  };

  world.getBuildingFoundationReport = () => world.buildingFoundationAudit || null;
  return world;
}
