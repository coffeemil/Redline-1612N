import { Game } from './platform/game.js';

const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Redline1612N: <canvas id="c"> is missing from the document');
}

const game = new Game(canvas);
game.start();

// Expose the instance for debugging from the console; harmless in production.
declare global {
  interface Window {
    redline?: Game;
  }
}
window.redline = game;
