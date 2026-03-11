# CSEdge Port Manager – Real-time Local Port Monitoring for Developers

CSEdge Port Manager is a production-focused Visual Studio Code extension for monitoring active local ports and safely terminating the processes bound to them. It is designed for developers who routinely work with frontend apps, backend services, APIs, local servers, and multi-service development environments where port visibility and control are operational requirements.

## Overview

Modern development workflows frequently involve multiple local servers running at the same time. When a process gets stuck, a port remains occupied, or a service restarts on the wrong port, developers usually have to switch to the terminal, inspect system processes manually, and run platform-specific commands to recover. CSEdge Port Manager centralizes that workflow inside Visual Studio Code.

The extension continuously scans active local ports, presents them in a dedicated Activity Bar panel, and provides direct actions to inspect, open, copy, refresh, and terminate processes. It is intended for frontend developers working with tools like Vite and Next.js, backend developers running APIs and services, and full-stack developers managing multiple local processes concurrently.

## Feature Highlights

- Real-time local port monitoring with automatic refresh cycles
- Cross-platform support for macOS, Linux, and Windows
- One-click process termination with confirmation flow
- Dedicated Activity Bar integration with a custom CSEdge view
- Search and filtering for quick port discovery
- Sorting by port, process name, or PID
- Developer-friendly dark-theme compatible interface
- Quick actions to open `localhost`, copy port values, and refresh immediately
- Visual highlighting for common development ports such as `3000`, `5173`, `8000`, and `8080`
- Live badge count to show the current number of active ports

## Who This Extension Is For

- Frontend developers running local dev servers and preview environments
- Backend developers managing APIs, workers, and local database-connected services
- Full-stack developers coordinating several services at once
- Teams that want a fast in-editor workflow for port visibility and recovery

## Installation For Local Development

### Step 1 – Clone the Repository

```bash
git clone https://github.com/durgesh-vaigandla/csedge-port-manager.git
cd csedge-port-manager
```

### Step 2 – Install Dependencies

```bash
npm install
```

### Step 3 – Open the Project in Visual Studio Code

Open the cloned project folder in VS Code.

### Step 4 – Run the Extension in Development Mode

Press `F5` in VS Code to launch an **Extension Development Host** window.

This opens a new VS Code window with the extension loaded in development mode, allowing you to test the Activity Bar view, commands, polling behavior, and process termination flow without publishing the extension.

## Testing The Extension

Use the following workflow to validate the extension end to end:

1. Start a local service, for example:

```bash
npm run dev
```

or

```bash
python -m http.server 3000
```

2. Open the **CSEdge Port Manager** icon from the VS Code Activity Bar.
3. Verify that the running port appears in the port list with the correct process name, PID, protocol, and status.
4. Use search or sorting controls to confirm the UI responds correctly.
5. Click `Open` to launch the localhost URL if applicable.
6. Click `Copy` to copy the port number to the clipboard.
7. Click `Kill` and confirm the action in the modal dialog.
8. Verify that the target process stops and the port is removed from the list on refresh.

## Build And Package The Extension

To generate a distributable VS Code extension package:

```bash
npm install -g @vscode/vsce
vsce package
```

This command produces a `.vsix` file in the project root. That file can be used for local installation, internal distribution, or later release workflows.

If you prefer to use the project-local dependency instead of a global install:

```bash
npx @vscode/vsce package --no-yarn
```

## Install The Extension Locally

To install the generated `.vsix` package in Visual Studio Code:

1. Open VS Code.
2. Go to the Extensions panel.
3. Click the three-dot menu in the top-right corner.
4. Choose **Install from VSIX...**
5. Select the generated `.vsix` file from the project directory.

After installation, the CSEdge Port Manager icon will appear in the Activity Bar on the left side of the editor.

## Commands

- `CSEdge: Show Running Ports`
- `CSEdge: Refresh Port List`
- `CSEdge: Kill Port`

## Project Structure

The project is organized to keep scanning logic, process control, and UI concerns clearly separated:

```text
src/
  commands/             Command palette registrations and handlers
  services/             Port scanning, polling, and process termination services
  types/                Shared TypeScript domain types
  ui/                   Webview provider and UI HTML generation
  utils/                Shared utilities such as debounce helpers
media/                  Icons and webview styling assets
package.json            Extension manifest, contribution points, scripts, metadata
README.md               Repository and marketplace-facing documentation
LICENSE                 License file
```

## Technical Notes

- Port scanning on macOS and Linux uses `lsof`
- Port scanning on Windows uses `netstat` with `tasklist`
- Process termination on macOS and Linux uses `kill`
- Process termination on Windows uses `taskkill`
- The monitoring loop uses debounced refresh handling to avoid unnecessary load

## Maintainer

Maintained by **CSEdge**  
Developed by **Durgesh Vaigandla**

- Website: [https://csedge.co](https://csedge.co)
- GitHub Profile: [https://github.com/durgesh-vaigandla](https://github.com/durgesh-vaigandla)
- Organization: [https://github.com/organizations/CSEdgeOfficial/](https://github.com/organizations/CSEdgeOfficial/)

## Contribution Guidelines

Contributions, feedback, and improvement proposals are welcome. A dedicated contribution process can be added as the project evolves. For now, contributors should open an issue describing the proposed change before submitting substantial modifications.

## License

This project is currently distributed under the terms defined in the [LICENSE](./LICENSE) file.
