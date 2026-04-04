import { powerMonitor } from 'electron';
import { getActiveSession, endSessionAndSync } from './session.js';

let mainWindow = null;

export function setupPowerMonitoring(window) {
  mainWindow = window;

  powerMonitor.on('suspend', async () => {
    console.log('System is suspending');
    const active = getActiveSession();

    if (active) {
      // End and sync the session before sleep so data is never lost
      try {
        const ended = await endSessionAndSync();
        if (mainWindow) {
          mainWindow.webContents.send('power:suspend', ended);
        }
      } catch (err) {
        console.error('Failed to end session on suspend:', err);
        if (mainWindow) {
          mainWindow.webContents.send('power:suspend', null);
        }
      }
    }
  });

  powerMonitor.on('resume', () => {
    console.log('System is resuming');

    if (mainWindow) {
      mainWindow.webContents.send('power:resume');
    }
  });
}
