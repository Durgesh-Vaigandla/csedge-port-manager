import * as vscode from 'vscode';
import { ProcessManagerService } from '../services/processManagerService';
import { PortMonitorService } from '../services/portMonitorService';
import { PortRecord } from '../types/port';
import { PortTreeItem } from '../ui/portTreeItem';
import { PortsTreeProvider, SortMode } from '../ui/portsTreeProvider';

export function registerCommandHandlers(
  provider: PortsTreeProvider,
  monitorService: PortMonitorService,
  processManagerService: ProcessManagerService,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('csedgePortManager.showPorts', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.csedgePortManager');
    }),
    vscode.commands.registerCommand('csedgePortManager.refreshPorts', async () => {
      await monitorService.refreshNow();
      provider.reveal();
      void vscode.window.showInformationMessage('CSEdge Port Manager refreshed.');
    }),
    vscode.commands.registerCommand('csedgePortManager.killPort', async (item?: PortTreeItem | PortRecord) => {
      const activeRecord = unwrapPortRecord(item) ?? await pickPort(monitorService.getSnapshot().ports);

      if (!activeRecord) {
        return;
      }

      await provider.killPort(activeRecord);
    }),
    vscode.commands.registerCommand('csedgePortManager.copyPort', async (item?: PortTreeItem | PortRecord) => {
      const activeRecord = unwrapPortRecord(item);
      if (!activeRecord) {
        return;
      }

      await vscode.env.clipboard.writeText(String(activeRecord.port));
      void vscode.window.showInformationMessage(`Port ${activeRecord.port} copied.`);
    }),
    vscode.commands.registerCommand('csedgePortManager.openBrowser', async (item?: PortTreeItem | PortRecord) => {
      const activeRecord = unwrapPortRecord(item);
      if (!activeRecord) {
        return;
      }

      await provider.openPortInBrowser(activeRecord);
    }),
    vscode.commands.registerCommand('csedgePortManager.viewProcessDetails', async (item?: PortTreeItem | PortRecord) => {
      const activeRecord = unwrapPortRecord(item);
      if (!activeRecord) {
        return;
      }

      const document = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: [
          `# Port ${activeRecord.port}`,
          '',
          `- Process: ${activeRecord.processName}`,
          `- PID: ${activeRecord.pid}`,
          `- Protocol: ${activeRecord.protocol}`,
          `- Status: ${activeRecord.status}`,
          `- Local Address: ${activeRecord.localAddress}`,
          `- Remote Address: ${activeRecord.remoteAddress ?? 'N/A'}`,
          '',
          '## Command Line',
          '',
          '```text',
          activeRecord.commandLine ?? activeRecord.processName,
          '```',
        ].join('\n'),
      });

      await vscode.window.showTextDocument(document, {
        preview: true,
        viewColumn: vscode.ViewColumn.Active,
      });
    }),
    vscode.commands.registerCommand('csedgePortManager.sortByPort', async () => {
      await provider.setSortMode('port');
    }),
    vscode.commands.registerCommand('csedgePortManager.sortByProcess', async () => {
      await provider.setSortMode('process');
    }),
    vscode.commands.registerCommand('csedgePortManager.sortByPid', async () => {
      await provider.setSortMode('pid');
    }),
  ];
}

function unwrapPortRecord(item?: PortTreeItem | PortRecord): PortRecord | undefined {
  if (!item) {
    return undefined;
  }

  if ('record' in item) {
    return item.record;
  }

  return item;
}

async function pickPort(ports: PortRecord[]): Promise<PortRecord | undefined> {
  if (!ports.length) {
    void vscode.window.showInformationMessage('No active ports found.');
    return undefined;
  }

  const selection = await vscode.window.showQuickPick(
    ports.map((port) => ({
      label: `${port.port} (${port.protocol})`,
      description: `${port.processName} • PID ${port.pid}`,
      detail: `${port.status} • ${port.localAddress}`,
      port,
    })),
    {
      title: 'Select a port to terminate',
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );

  return selection?.port;
}
