import { powerMonitor } from 'electron';
import { pauseSession } from './session.js';

let mainWindow = null;

export function setupPowerMonitoring(window) {
  mainWindow = window;

  powerMonitor.on('suspend', () => {
    console.log('System is suspending');
    const pausedSession = pauseSession();

    if (pausedSession && mainWindow) {
      mainWindow.webContents.send('power:suspend', pausedSession);
    }
  });

  powerMonitor.on('resume', () => {
    console.log('System is resuming');

    if (mainWindow) {
      mainWindow.webContents.send('power:resume');
    }
  });
}
