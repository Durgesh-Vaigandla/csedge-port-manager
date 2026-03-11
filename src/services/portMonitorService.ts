import * as vscode from 'vscode';
import { debounce } from '../utils/debounce';
import { PortScannerService } from './portScannerService';
import { ScanResult } from '../types/port';

type MonitorListener = (result: ScanResult) => void;

export class PortMonitorService implements vscode.Disposable {
  private readonly listeners = new Set<MonitorListener>();
  private readonly debouncedRefresh: () => void;
  private timer: NodeJS.Timeout | undefined;
  private isRefreshing = false;
  private refreshQueued = false;
  private latestResult: ScanResult = {
    ports: [],
    scannedAt: new Date(0).toISOString(),
  };

  public constructor(private readonly scannerService: PortScannerService) {
    this.debouncedRefresh = debounce(() => {
      void this.refreshNow();
    }, 250);
  }

  public start(): void {
    this.restartTimer();
  }

  public reloadConfiguration(): void {
    this.restartTimer();
  }

  public getSnapshot(): ScanResult {
    return this.latestResult;
  }

  public onDidUpdate(listener: MonitorListener): vscode.Disposable {
    this.listeners.add(listener);

    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  public scheduleRefresh(): void {
    this.debouncedRefresh();
  }

  public async refreshNow(): Promise<ScanResult> {
    if (this.isRefreshing) {
      this.refreshQueued = true;
      return this.latestResult;
    }

    this.isRefreshing = true;

    try {
      this.latestResult = await this.scannerService.scanPorts();
      this.emit(this.latestResult);
      return this.latestResult;
    } finally {
      this.isRefreshing = false;

      if (this.refreshQueued) {
        this.refreshQueued = false;
        void this.refreshNow();
      }
    }
  }

  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.listeners.clear();
  }

  private restartTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const interval = vscode.workspace.getConfiguration('csedgePortManager').get<number>('pollingIntervalMs', 5000);
    this.timer = setInterval(() => {
      this.scheduleRefresh();
    }, interval);
  }

  private emit(result: ScanResult): void {
    for (const listener of this.listeners) {
      listener(result);
    }
  }
}
