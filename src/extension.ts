import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as child from 'child_process'

// ------------------------------------------------------------

interface IConfig {
  path: string
  reuseInstance: boolean
  runCommand: string
  showTitlebarIcon: boolean
}

// ------------------------------------------------------------

const MESSAGES_TEXT = {
  WindowsOnly: "This extension works only on Windows, sorry",
  ShowInfo: "Show Info",
  ReadmeUrl: "https://github.com/ipatalas/vscode-conemu/blob/master/README.md",
  ConEmuPathNotConfigured: "ConEmu path is not configured. Set proper path in ConEmu.path setting",
  OpenSettings: "Open Settings",
  ConEmuPathInvalid: "ConEmu path is invalid, please correct it."
}

// ------------------------------------------------------------

let outputChannel: vscode.OutputChannel = null

function writeOutput (line: string, showChannel: boolean = false): void {
  if (!outputChannel) {
    // tslint:disable-next-line:no-var-requires
    const pkg = require('../../package.json')

    outputChannel = vscode.window.createOutputChannel(pkg.displayName)
  }

  outputChannel.appendLine(line)

  if (showChannel) {
    outputChannel.show(true)
  }
}

// ------------------------------------------------------------

async function showInfoMessage (message: string, action?: string, onAction?: (btn: string) => void) {
  const btn = await vscode.window.showInformationMessage(message, action)

  return onAction && btn === action
    ? await onAction(btn)
    : true
}

// ------------------------------------------------------------

const getConfig = () => vscode.workspace.getConfiguration("ConEmu") as any as IConfig

// ------------------------------------------------------------

async function checkConfiguration () {
  const openSettingsCallback = btn => {
    vscode.commands.executeCommand("workbench.action.openGlobalSettings")
  }

  const config = getConfig()

  if (!config.path) {
    showInfoMessage(MESSAGES_TEXT.ConEmuPathNotConfigured, MESSAGES_TEXT.OpenSettings, openSettingsCallback)
    return false
  }

  if (!fs.existsSync(config.path)) {
    showInfoMessage(MESSAGES_TEXT.ConEmuPathInvalid, MESSAGES_TEXT.OpenSettings, openSettingsCallback)
    return false
  }

  return true
}

// ------------------------------------------------------------

const isCompatiblePlatform = process.platform === 'win32'

export async function activate (context: vscode.ExtensionContext) {
  if (!isCompatiblePlatform) {
    showInfoMessage(MESSAGES_TEXT.WindowsOnly, MESSAGES_TEXT.ShowInfo, btn => {
      child.exec(`start ${MESSAGES_TEXT.ReadmeUrl}`).unref()
    })

    return
  }

  context.subscriptions.push(vscode.commands.registerCommand('vscode.conemu', (uri?: vscode.Uri) => {
    if (!checkConfiguration()) {
      return
    }

    let target = null

    if (uri && uri.scheme && uri.scheme !== "untitled") {
      target = path.dirname(uri.fsPath)
    } else if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
      target = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath)
    } else if (vscode.workspace.rootPath) {
      target = vscode.workspace.rootPath
    }

    // writeOutput(`vscode.conemu(uri: ${uri.toString()}, target: ${target})`)

    if (target) {
      runConEmu(target)
    }
  }))
}

// ------------------------------------------------------------

const runConEmu = (targetDir: string) => {
  // const quote = p => p.includes(" ") ? `"${p}"` : p

  const config = getConfig()

  const reuseInstanceArg = config.reuseInstance ? "-Single" : "-NoSingle"

  let cmd = `"${config.path}" ${reuseInstanceArg} -Dir "${targetDir}"`

  if (config.runCommand) {
    cmd += ` -Run "${config.runCommand}"`
  }

  // writeOutput(`config: ${JSON.stringify(config, null, 2)}\n\ncommand: ${cmd}`)

  child.exec(cmd, (error: Error, _stdout: string, stderr: string) => {
    if (error) {
      vscode.window.showErrorMessage(`error: ${error.message}`)
      // writeOutput(`error: ${error.message}`, true)
    }

    if (stderr) {
      vscode.window.showErrorMessage(`stderr: ${stderr}`)
      // writeOutput(`stderr: ${stderr}`, true)
    }
  })
}
