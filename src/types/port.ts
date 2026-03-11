export type PortProtocol = 'TCP' | 'UDP';

export type PortConnectionStatus = 'LISTENING' | 'ESTABLISHED' | 'UNKNOWN';

export interface PortProcessInfo {
  pid: number;
  processName: string;
}

export interface PortRecord extends PortProcessInfo {
  id: string;
  port: number;
  protocol: PortProtocol;
  status: PortConnectionStatus;
  localAddress: string;
  remoteAddress?: string;
  commandLine?: string;
  isDevPort: boolean;
}

export interface ScanResult {
  ports: PortRecord[];
  scannedAt: string;
  error?: string;
}
