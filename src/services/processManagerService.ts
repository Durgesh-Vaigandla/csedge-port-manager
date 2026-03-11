import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import { PortRecord } from '../types/port';

const execAsync = promisify(exec);

export class ProcessManagerService {
  public async killPort(record: PortRecord): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
      await execAsync(`taskkill /PID ${record.pid} /T /F`, {
        timeout: 8000,
        windowsHide: true,
      });
      return;
    }

    try {
      await execAsync(`kill -TERM ${record.pid}`, {
        timeout: 8000,
      });
    } catch {
      await execAsync(`kill -KILL ${record.pid}`, {
        timeout: 8000,
      });
    }
  }
}
