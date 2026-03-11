import * as vscode from 'vscode';
import { ProcessManagerService } from '../services/processManagerService';
import { PortMonitorService } from '../services/portMonitorService';
import { PortRecord, ScanResult } from '../types/port';
import { PortDetailTreeItem, PortGroup, PortGroupKind, PortGroupTreeItem, PortNode, PortTreeItem } from './portTreeItem';

export type SortMode = 'port' | 'process' | 'pid';

export class PortsTreeProvider implements vscode.TreeDataProvider<PortNode> {
  public static readonly viewId = 'csedgePortManager.panel';

  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<PortNode | undefined | null | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly groups = new Map<PortGroupKind, PortGroup>();
  private readonly treeView: vscode.TreeView<PortNode>;
  private currentSnapshot: ScanResult = { ports: [], scannedAt: new Date(0).toISOString() };
  private sortMode: SortMode;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly monitorService: PortMonitorService,
    private readonly processManagerService: ProcessManagerService,
  ) {
    this.sortMode = this.context.workspaceState.get<SortMode>('csedgePortManager.sortMode', 'port');
    this.treeView = vscode.window.createTreeView(PortsTreeProvider.viewId, {
      treeDataProvider: this,
      showCollapseAll: true,
    });

    this.context.subscriptions.push(this.treeView);
    this.context.subscriptions.push(
      this.monitorService.onDidUpdate((snapshot) => {
        this.currentSnapshot = snapshot;
        this.refresh();
      }),
    );
  }

  public getTreeItem(element: PortNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: PortNode): vscode.ProviderResult<PortNode[]> {
    if (!element) {
      return this.buildGroups().map((group) => new PortGroupTreeItem(group));
    }

    if (element instanceof PortGroupTreeItem) {
      return element.group.ports.map((record) => new PortTreeItem(record, element.group.kind));
    }

    if (element instanceof PortTreeItem) {
      return [
        new PortDetailTreeItem(`detail:${element.record.id}:process`, 'Process', element.record.processName, 'symbol-method'),
        new PortDetailTreeItem(`detail:${element.record.id}:status`, 'Status', element.record.status, 'pulse'),
        new PortDetailTreeItem(`detail:${element.record.id}:protocol`, 'Protocol', element.record.protocol, 'radio-tower'),
        new PortDetailTreeItem(`detail:${element.record.id}:address`, 'Address', element.record.localAddress, 'location'),
        new PortDetailTreeItem(`detail:${element.record.id}:command`, 'Command', element.record.commandLine ?? element.record.processName, 'terminal'),
      ];
    }

    return [];
  }

  public async reveal(): Promise<void> {
    await vscode.commands.executeCommand('workbench.view.extension.csedgePortManager');
    await vscode.commands.executeCommand(`${PortsTreeProvider.viewId}.focus`);
  }

  public async setSortMode(mode: SortMode): Promise<void> {
    this.sortMode = mode;
    await this.context.workspaceState.update('csedgePortManager.sortMode', mode);
    this.refresh();
    void vscode.window.showInformationMessage(`CSEdge Port Manager sorting by ${mode}.`);
  }

  public async killPort(record: PortRecord): Promise<void> {
    const shouldConfirm = vscode.workspace.getConfiguration('csedgePortManager').get<boolean>('confirmBeforeKill', true);

    if (shouldConfirm) {
      const confirmation = await vscode.window.showWarningMessage(
        `Terminate ${record.processName} (PID ${record.pid}) on port ${record.port}?`,
        { modal: true, detail: `Protocol: ${record.protocol} • Status: ${record.status}` },
        'Kill Process',
      );

      if (confirmation !== 'Kill Process') {
        return;
      }
    }

    try {
      await this.processManagerService.killPort(record);
      void vscode.window.showInformationMessage(`Terminated ${record.processName} on port ${record.port}.`);
      await this.monitorService.refreshNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown termination failure';
      void vscode.window.showErrorMessage(`Failed to kill port ${record.port}: ${message}`);
    }
  }

  public async openPortInBrowser(record: PortRecord): Promise<void> {
    const allowOpen = vscode.workspace.getConfiguration('csedgePortManager').get<boolean>('autoOpenLocalhost', true);
    if (!allowOpen) {
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${record.port}`));
  }

  public attachStatusBar(statusBarItem: vscode.StatusBarItem): void {
    const update = (): void => {
      const count = this.currentSnapshot.ports.length;
      statusBarItem.text = `$(radio-tower) Ports: ${count} Active`;
      statusBarItem.tooltip = this.currentSnapshot.error
        ? `CSEdge Port Manager\n\nLast scan error: ${this.currentSnapshot.error}`
        : `CSEdge Port Manager\n\n${count} active local ports`;
    };

    update();
    this.context.subscriptions.push(this.monitorService.onDidUpdate(() => update()));
  }

  private refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
    this.updateViewMetadata();
  }

  private updateViewMetadata(): void {
    const count = this.currentSnapshot.ports.length;
    this.treeView.badge = { value: count, tooltip: `${count} active local ports` };
    this.treeView.description = `${count} active`;
    this.treeView.message = this.currentSnapshot.error
      ? `Port scan issue: ${this.currentSnapshot.error}`
      : count === 0
        ? 'No active ports detected. Monitoring is running.'
        : `Sorted by ${this.sortMode}`;
  }

  private buildGroups(): PortGroup[] {
    const groups: Record<PortGroupKind, PortRecord[]> = {
      development: [],
      system: [],
      unknown: [],
    };

    for (const port of this.currentSnapshot.ports) {
      groups[this.classifyPort(port)].push(port);
    }

    const orderedKinds: PortGroupKind[] = ['development', 'system', 'unknown'];
    this.groups.clear();

    for (const kind of orderedKinds) {
      const group: PortGroup = {
        kind,
        label: kind === 'development' ? 'Development Servers' : kind === 'system' ? 'System Processes' : 'Unknown Processes',
        description: kind === 'development'
          ? 'Common local dev servers and app runtimes'
          : kind === 'system'
            ? 'Known listeners and background services'
            : 'Processes with incomplete metadata',
        ports: this.sortPorts(groups[kind]),
      };
      this.groups.set(kind, group);
    }

    return orderedKinds
      .map((kind) => this.groups.get(kind)!)
      .filter((group) => group.ports.length > 0);
  }

  private sortPorts(ports: PortRecord[]): PortRecord[] {
    return [...ports].sort((left, right) => {
      if (this.sortMode === 'process') {
        return left.processName.localeCompare(right.processName) || left.port - right.port;
      }

      if (this.sortMode === 'pid') {
        return left.pid - right.pid || left.port - right.port;
      }

      return left.port - right.port || left.processName.localeCompare(right.processName);
    });
  }

  private classifyPort(record: PortRecord): PortGroupKind {
    const name = record.processName.toLowerCase();
    const command = (record.commandLine ?? '').toLowerCase();
    const devPattern = /(node|vite|webpack|next|nuxt|python|uvicorn|gunicorn|flask|bun|deno|ruby|rails|php|java|go|cargo|npm|pnpm|yarn)/;

    if (record.isDevPort || devPattern.test(name) || devPattern.test(command)) {
      return 'development';
    }

    if (record.processName === 'Unknown' || !record.processName.trim()) {
      return 'unknown';
    }

    return 'system';
  }
}
