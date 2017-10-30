'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child from 'child_process';

// ------------------------------------------------------------

// tslint:disable-next-line:no-var-requires
const pkg = require('../../package.json');

const isCompatiblePlatform = process.platform === 'win32';

// ------------------------------------------------------------

let outputChannel: vscode.OutputChannel = null;

function writeOutput(line: string, showChannel: boolean = false): void {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(pkg.displayName);
	}

	outputChannel.appendLine(line)

	if (showChannel) {
		outputChannel.show(true);
	}
}

// ------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
	if (!isCompatiblePlatform) {
		vscode.window.showInformationMessage(messages.WindowsOnly, messages.ShowInfo).then(btn => {
			if (btn === messages.ShowInfo) {
				child.exec(`start ${messages.ReadmeUrl}`).unref();
			}
		});
	}

	context.subscriptions.push(vscode.commands.registerCommand('vscode.conemu', (uri?: vscode.Uri) => {
		// tslint:disable-next-line:curly
		if (!isCompatiblePlatform || !checkConfiguration()) return;

		let target = null;

		if (uri && uri.scheme && uri.scheme !== "untitled") {
			target = path.dirname(uri.fsPath);
		} else if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
			target = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
		} else if (vscode.workspace.rootPath) {
			target = vscode.workspace.rootPath;
		}

		writeOutput(`vscode.conemu(uri: ${uri.toString()}, target: ${target})`);

		runConEmu(target);
	}));
}

// ------------------------------------------------------------

const runConEmu = (path: string) => {
	const quote = (p: string) => p.includes(" ") ? `"${p}"` : p;

	const config = getConfig();

	const reuseInstanceArg = config.reuseInstance ? "-Single" : "-NoSingle";

	let cmd = `${quote(config.path)} ${reuseInstanceArg} -Dir ${quote(path)}`;

	if (config.runCommand) {
		cmd += ` -Run ${quote(config.runCommand)}`;
	}

	writeOutput(`config: ${JSON.stringify(config, null, 2)}\n\ncommand: ${cmd}`);

	child.exec(cmd, (error: Error, _stdout: string, stderr: string) => {
		if (error) {
			writeOutput(`error: ${error.message}`, true);
		}

		if (stderr) {
			writeOutput(`stderr: ${stderr}`, true);
		}
	});
};

// ------------------------------------------------------------

interface IConfig {
	path: string;
	reuseInstance: boolean;
	runCommand: string;
	showTitlebarIcon: boolean;
}

// ------------------------------------------------------------

const getConfig = () => vscode.workspace.getConfiguration("ConEmu") as any as IConfig;

// ------------------------------------------------------------

const checkConfiguration = () => {
	const openSettingsCallback = (btn) => {
		if (btn === messages.OpenSettings) {
			vscode.commands.executeCommand("workbench.action.openGlobalSettings");
		}
	};

	const config = getConfig();

	if (!config.path) {
		vscode.window.showInformationMessage(messages.ConEmuPathNotConfigured, messages.OpenSettings).then(openSettingsCallback);
		return false;
	}

	if (!fs.existsSync(config.path)) {
		vscode.window.showInformationMessage(messages.ConEmuPathInvalid, messages.OpenSettings).then(openSettingsCallback);
		return false;
	}

	return true;
};

// ------------------------------------------------------------

const messages = {
	WindowsOnly: "This extension works only on Windows, sorry",
	ShowInfo: "Show Info",
	ReadmeUrl: "https://github.com/ipatalas/vscode-conemu/blob/master/README.md",
	ConEmuPathNotConfigured: "ConEmu path is not configured. Set proper path in ConEmu.path setting",
	OpenSettings: "Open Settings",
	ConEmuPathInvalid: "ConEmu path is invalid, please correct it."
};
