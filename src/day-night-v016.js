export function installDayNightExperience(world) {
  if (!world || world.__dayNightV016) return world;
  world.__dayNightV016 = true;

  const select = document.querySelector('#gameMode');
  const isNight = () => (select?.value || 'rpg') === 'shooter';

  // Keep the proven engine behaviours internally:
  // day -> RPG vertical controller (jetpack)
  // night -> shooter controller (weapon/aim/recoil)
  // Then layer horror lighting/flashlight onto the night controller.
  const baseApply = world.applyGameModeVisuals.bind(world);
  const baseFlashlight = world.updateFlashlight.bind(world);

  world.applyGameModeVisuals = engineMode => {
    if (isNight()) {
      if (world.__dayNightVisualState !== 'night') {
        baseApply('horror');
        world.__dayNightVisualState = 'night';
      }
      const rig = world.agent?.userData?.rig;
      if (rig) {
        rig.pistol.visible = true;
        rig.jetpack.visible = false;
      }
      if (world.fpWeapon) world.fpWeapon.visible = world.mode === 'firstperson';
      if (world.flashGroup) world.flashGroup.visible = !!world.flashlightOn;
      return;
    }

    if (world.__dayNightVisualState !== 'day') {
      baseApply('rpg');
      world.__dayNightVisualState = 'day';
    }
    const rig = world.agent?.userData?.rig;
    if (rig) {
      rig.pistol.visible = false;
      rig.jetpack.visible = true;
    }
    if (world.fpWeapon) world.fpWeapon.visible = false;
    if (world.flashGroup) world.flashGroup.visible = false;
  };

  world.updateFlashlight = engineMode => baseFlashlight(isNight() ? 'horror' : engineMode);

  // The base engine sees night as "shooter", so its own F listener intentionally
  // does not toggle the light. runtime.js handles F via the presentation-mode ID
  // and this listener is only a fallback for direct engine usage.
  window.addEventListener('keydown', event => {
    if (event.code !== 'KeyF' || event.repeat || !isNight()) return;
    if (document.body.classList.contains('map-mode')) return;
    // runtime.js stops propagation and toggles first during normal app usage.
    if (event.defaultPrevented) return;
    world.flashlightOn = !world.flashlightOn;
  });

  world.getExperienceMode = () => isNight() ? 'night' : 'day';
  return world;
}
