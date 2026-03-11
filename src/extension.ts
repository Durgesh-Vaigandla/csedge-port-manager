import * as vscode from 'vscode';
import { registerCommandHandlers } from './commands/commandHandlers';
import { PortMonitorService } from './services/portMonitorService';
import { PortScannerService } from './services/portScannerService';
import { ProcessManagerService } from './services/processManagerService';
import { PortsTreeProvider } from './ui/portsTreeProvider';

let monitorService: PortMonitorService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const scannerService = new PortScannerService();
  const processManagerService = new ProcessManagerService();
  monitorService = new PortMonitorService(scannerService);

  const provider = new PortsTreeProvider(context, monitorService, processManagerService);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'csedgePortManager.showPorts';
  statusBarItem.name = 'CSEdge Port Manager';
  statusBarItem.show();
  provider.attachStatusBar(statusBarItem);

  context.subscriptions.push(...registerCommandHandlers(provider, monitorService, processManagerService));
  context.subscriptions.push(monitorService);
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('csedgePortManager.pollingIntervalMs')) {
        monitorService?.reloadConfiguration();
      }

      if (event.affectsConfiguration('csedgePortManager.autoOpenLocalhost')
        || event.affectsConfiguration('csedgePortManager.confirmBeforeKill')) {
        void monitorService?.refreshNow();
      }
    }),
  );

  monitorService.start();
  void monitorService.refreshNow();
}

export function deactivate(): void {
  monitorService?.dispose();
  monitorService = undefined;
}
