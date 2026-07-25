import Phaser from "phaser";

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export function rerenderOnResize(scene: Phaser.Scene, render: () => void) {
  const onResize = () => render();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });
}
