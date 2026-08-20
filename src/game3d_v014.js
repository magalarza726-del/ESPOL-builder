import { createGameWorld as createV013World } from './game3d_v013.js';
import { auditFoundation, PROJECT } from './project-foundation.js';

export async function createGameWorld(options) {
  const world = await createV013World(options);
  const upstreamSetStructures = world.setStructures.bind(world);

  world.setStructures = structures => {
    upstreamSetStructures(structures);
    const report = auditFoundation(world, structures);
    world.foundationReport = report;
    globalThis.__ESPOL_FOUNDATION_REPORT__ = report;

    if (!report.ok) {
      const message = `Foundation audit failed: ${report.hardErrors.join(', ')}`;
      console.error(message, report);
      throw new Error(message);
    }
    if (report.warnings.length) console.warn(`${PROJECT.version} foundation audit: degraded`, report);
    else console.info(`${PROJECT.version} foundation audit: OK`, report);
  };

  world.getFoundationReport = () => world.foundationReport || null;
  return world;
}
