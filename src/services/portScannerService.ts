import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import { PortConnectionStatus, PortRecord, PortProtocol, ScanResult } from '../types/port';

const execAsync = promisify(exec);
const DEV_PORTS = new Set([3000, 3001, 4173, 4200, 4321, 5000, 5173, 5174, 5432, 5500, 6379, 8000, 8080, 8081, 8787, 9000]);

interface CommandResult {
  stdout: string;
  stderr: string;
}

export class PortScannerService {
  private readonly commandLineCache = new Map<number, { value: string; expiresAt: number }>();

  public async scanPorts(): Promise<ScanResult> {
    const scannedAt = new Date().toISOString();

    try {
      const platform = os.platform();
      const ports = platform === 'win32'
        ? await this.scanWindowsPorts()
        : await this.scanUnixPorts();
      await this.enrichCommandLines(ports, platform);

      return {
        ports: this.sortAndNormalize(ports),
        scannedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown port scan failure';

      return {
        ports: [],
        scannedAt,
        error: message,
      };
    }
  }

  private async scanUnixPorts(): Promise<PortRecord[]> {
    const tcp = await this.runCommand('lsof -nP -iTCP -sTCP:LISTEN,ESTABLISHED -F pcPnT');
    const udp = await this.runCommand('lsof -nP -iUDP -F pcPn');

    return [
      ...this.parseUnixLsofOutput(tcp.stdout, 'TCP'),
      ...this.parseUnixLsofOutput(udp.stdout, 'UDP'),
    ];
  }

  private async scanWindowsPorts(): Promise<PortRecord[]> {
    const [tcp, udp, tasklist] = await Promise.all([
      this.runCommand('netstat -ano -p tcp'),
      this.runCommand('netstat -ano -p udp'),
      this.runCommand('tasklist /FO CSV /NH'),
    ]);

    const pidMap = this.parseTaskList(tasklist.stdout);

    return [
      ...this.parseWindowsNetstatOutput(tcp.stdout, 'TCP', pidMap),
      ...this.parseWindowsNetstatOutput(udp.stdout, 'UDP', pidMap),
    ];
  }

  private async runCommand(command: string): Promise<CommandResult> {
    return execAsync(command, {
      timeout: 8000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    });
  }

  private parseUnixLsofOutput(output: string, protocol: PortProtocol): PortRecord[] {
    const records: PortRecord[] = [];
    const lines = output.split(/\r?\n/).filter(Boolean);
    let currentPid = 0;
    let currentCommand = 'Unknown';
    let currentProtocol: PortProtocol = protocol;
    let currentName = '';
    let currentStatus: PortConnectionStatus = protocol === 'UDP' ? 'LISTENING' : 'UNKNOWN';

    const flushRecord = (): void => {
      if (!currentPid || !currentName) {
        return;
      }

      const parsed = this.parseEndpoint(currentName);
      if (!parsed.port) {
        return;
      }

      records.push(this.createRecord({
        pid: currentPid,
        processName: currentCommand,
        port: parsed.port,
        protocol: currentProtocol,
        status: currentStatus === 'UNKNOWN' && protocol === 'UDP' ? 'LISTENING' : currentStatus,
        localAddress: parsed.localAddress,
        remoteAddress: parsed.remoteAddress,
      }));
    };

    for (const line of lines) {
      const field = line[0];
      const value = line.slice(1);

      if (field === 'p') {
        flushRecord();
        currentPid = Number.parseInt(value, 10);
        currentCommand = 'Unknown';
        currentProtocol = protocol;
        currentName = '';
        currentStatus = protocol === 'UDP' ? 'LISTENING' : 'UNKNOWN';
        continue;
      }

      if (field === 'c') {
        currentCommand = value || 'Unknown';
        continue;
      }

      if (field === 'P') {
        currentProtocol = value.toUpperCase() === 'UDP' ? 'UDP' : 'TCP';
        continue;
      }

      if (field === 'n') {
        currentName = value;
        const parenState = value.match(/\(([^)]+)\)$/)?.[1];
        if (parenState) {
          currentStatus = this.normalizeStatus(parenState);
        }
        continue;
      }

      if (field === 'T' && value.startsWith('ST=')) {
        currentStatus = this.normalizeStatus(value.slice(3));
      }
    }

    flushRecord();

    return records;
  }

  private parseWindowsNetstatOutput(output: string, protocol: PortProtocol, pidMap: Map<number, string>): PortRecord[] {
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const records: PortRecord[] = [];

    for (const line of lines) {
      if (!line.startsWith(protocol)) {
        continue;
      }

      const parts = line.split(/\s+/);
      const isTcp = protocol === 'TCP';

      if ((isTcp && parts.length < 5) || (!isTcp && parts.length < 4)) {
        continue;
      }

      const local = parts[1];
      const remote = parts[2];
      const status = isTcp ? this.normalizeStatus(parts[3]) : 'LISTENING';
      const pidIndex = isTcp ? 4 : 3;
      const pid = Number.parseInt(parts[pidIndex], 10);
      const port = this.extractPort(local);

      if (!port || Number.isNaN(pid)) {
        continue;
      }

      records.push(this.createRecord({
        pid,
        processName: pidMap.get(pid) ?? 'Unknown',
        port,
        protocol,
        status,
        localAddress: local,
        remoteAddress: remote === '*:*' ? undefined : remote,
      }));
    }

    return records;
  }

  private parseTaskList(output: string): Map<number, string> {
    const map = new Map<number, string>();
    const lines = output.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const parts = line.replace(/^"|"$/g, '').split('","');
      if (parts.length < 2) {
        continue;
      }

      const pid = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(pid)) {
        map.set(pid, parts[0]);
      }
    }

    return map;
  }

  private parseEndpoint(name: string): { port?: number; localAddress: string; remoteAddress?: string } {
    const [endpointPart] = name.split(' (');
    const [localAddress, remoteAddress] = endpointPart.split('->');
    const port = this.extractPort(localAddress);

    return {
      port,
      localAddress,
      remoteAddress,
    };
  }

  private extractPort(endpoint: string): number | undefined {
    const cleaned = endpoint.replace(/^\[|\]$/g, '').trim();
    const match = cleaned.match(/:(\d+)(?:\s|$)/) ?? cleaned.match(/\.(\d+)(?:\s|$)/);
    if (!match) {
      return undefined;
    }

    const port = Number.parseInt(match[1], 10);
    return Number.isNaN(port) ? undefined : port;
  }

  private normalizeStatus(value: string): 'LISTENING' | 'ESTABLISHED' | 'UNKNOWN' {
    const normalized = value.trim().toUpperCase();

    if (normalized === 'LISTEN' || normalized === 'LISTENING') {
      return 'LISTENING';
    }

    if (normalized === 'ESTABLISHED') {
      return 'ESTABLISHED';
    }

    return 'UNKNOWN';
  }

  private createRecord(input: Omit<PortRecord, 'id' | 'isDevPort'>): PortRecord {
    return {
      ...input,
      id: `${input.protocol}-${input.port}-${input.pid}-${input.status}`,
      isDevPort: DEV_PORTS.has(input.port),
    };
  }

  private sortAndNormalize(records: PortRecord[]): PortRecord[] {
    const deduped = new Map<string, PortRecord>();

    for (const record of records) {
      deduped.set(record.id, record);
    }

    return [...deduped.values()].sort((left, right) => {
      if (left.port !== right.port) {
        return left.port - right.port;
      }

      if (left.processName !== right.processName) {
        return left.processName.localeCompare(right.processName);
      }

      return left.pid - right.pid;
    });
  }

  private async enrichCommandLines(records: PortRecord[], platform: NodeJS.Platform): Promise<void> {
    const uniquePids = [...new Set(records.map((record) => record.pid))];
    const pidToCommand = new Map<number, string>();
    const stalePids: number[] = [];
    const now = Date.now();

    for (const pid of uniquePids) {
      const cached = this.commandLineCache.get(pid);
      if (cached && cached.expiresAt > now) {
        pidToCommand.set(pid, cached.value);
      } else {
        stalePids.push(pid);
      }
    }

    if (stalePids.length) {
      const freshValues = platform === 'win32'
        ? await this.loadWindowsCommandLines(stalePids)
        : await this.loadUnixCommandLines(stalePids);

      for (const [pid, commandLine] of freshValues) {
        this.commandLineCache.set(pid, {
          value: commandLine,
          expiresAt: now + 30000,
        });
        pidToCommand.set(pid, commandLine);
      }
    }

    for (const record of records) {
      record.commandLine = pidToCommand.get(record.pid) ?? record.processName;
    }
  }

  private async loadUnixCommandLines(pids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!pids.length) {
      return map;
    }

    try {
      const { stdout } = await this.runCommand(`ps -p ${pids.join(',')} -o pid=,command=`);
      const lines = stdout.split(/\r?\n/).filter(Boolean);

      for (const line of lines) {
        const match = line.trim().match(/^(\d+)\s+(.*)$/);
        if (!match) {
          continue;
        }

        map.set(Number.parseInt(match[1], 10), match[2].trim());
      }
    } catch {
      return map;
    }

    return map;
  }

  private async loadWindowsCommandLines(pids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!pids.length) {
      return map;
    }

    const filter = pids.map((pid) => `ProcessId=${pid}`).join(' or ');

    try {
      const { stdout } = await this.runCommand(
        `wmic process where "${filter}" get ProcessId,CommandLine /FORMAT:CSV`,
      );
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('Node,') || line.startsWith(',')) {
          const parts = line.split(',');
          const pid = Number.parseInt(parts[parts.length - 1], 10);
          const commandLine = parts.slice(1, -1).join(',').trim();

          if (!Number.isNaN(pid) && commandLine) {
            map.set(pid, commandLine);
          }
        }
      }
    } catch {
      return map;
    }

    return map;
  }
}
