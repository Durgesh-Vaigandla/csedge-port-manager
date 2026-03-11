import * as vscode from 'vscode';
import { PortRecord } from '../types/port';

export type PortGroupKind = 'development' | 'system' | 'unknown';

export interface PortGroup {
  kind: PortGroupKind;
  label: string;
  description: string;
  ports: PortRecord[];
}

export type PortNode = PortGroupTreeItem | PortTreeItem | PortDetailTreeItem;

export class PortGroupTreeItem extends vscode.TreeItem {
  public constructor(public readonly group: PortGroup) {
    super(group.label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `group:${group.kind}`;
    this.contextValue = 'portGroupItem';
    this.description = `${group.ports.length}`;
    this.tooltip = `${group.label}: ${group.description}`;
    this.iconPath = new vscode.ThemeIcon(group.kind === 'development' ? 'rocket' : group.kind === 'system' ? 'server-process' : 'question');
  }
}

export class PortTreeItem extends vscode.TreeItem {
  public constructor(public readonly record: PortRecord, groupKind: PortGroupKind) {
    super(`Port ${record.port}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `port:${record.id}`;
    this.contextValue = 'portItem';
    this.description = `${record.processName} (PID ${record.pid})`;
    this.tooltip = new vscode.MarkdownString(
      [
        `**Port ${record.port}**`,
        '',
        `Process: \`${record.processName}\``,
        `PID: \`${record.pid}\``,
        `Protocol: \`${record.protocol}\``,
        `Status: \`${record.status}\``,
        `Local Address: \`${record.localAddress}\``,
        `Remote Address: \`${record.remoteAddress ?? 'N/A'}\``,
        `Command: \`${record.commandLine ?? record.processName}\``,
      ].join('  \n'),
    );
    this.command = {
      command: 'csedgePortManager.viewProcessDetails',
      title: 'View Process Details',
      arguments: [this],
    };
    this.iconPath = new vscode.ThemeIcon(
      record.isDevPort || groupKind === 'development'
        ? 'rocket'
        : groupKind === 'system'
          ? 'server-process'
          : 'question',
      new vscode.ThemeColor(record.isDevPort ? 'charts.green' : 'foreground'),
    );
  }
}

export class PortDetailTreeItem extends vscode.TreeItem {
  public constructor(id: string, label: string, value: string, codicon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = id;
    this.contextValue = 'portDetailItem';
    this.description = value;
    this.tooltip = `${label}: ${value}`;
    this.iconPath = new vscode.ThemeIcon(codicon);
  }
}
