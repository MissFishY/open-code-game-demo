/**
 * Entry point: boots the game and wires up the canvas.
 */

import './style.css';
import { Game } from './systems/Game';
import { GameUI } from './ui/GameUI';

function start(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('index.html 里缺少 #game-canvas');
  }

  const ui = new GameUI();
  const game = new Game(canvas, ui);

  // Clicking the canvas re-captures the mouse for camera control.
  canvas.addEventListener('click', () => {
    // Any panel open means the mouse belongs to the UI, not the camera.
    if (!ui.isTitleVisible && !ui.isDialogueOpen && !ui.isPanelOpen) {
      game.requestPointerLock();
    }
  });

  game.boot().catch((error: unknown) => {
    console.error('游戏启动失败', error);
    ui.setLoadingText('抬起岛屿的时候出了点问题，请看控制台。');
  });

  // Expose the game for debugging in the browser console.
  (window as unknown as { islandGame?: Game }).islandGame = game;
}

start();
