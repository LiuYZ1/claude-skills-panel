import * as vscode from "vscode";
import { SkillsPanelProvider } from "./skillsProvider";
import { getAllSkills, importSkillFromGit } from "./skillsData";

export function activate(context: vscode.ExtensionContext): void {
  // Register the sidebar webview provider
  const provider = new SkillsPanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SkillsPanelProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Command: copy a skill command to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-skills-panel.copySkill", (command: string) => {
      vscode.env.clipboard.writeText(command).then(() => {
        vscode.window.showInformationMessage(`✅ 已复制 ${command} 到剪贴板`);
      });
    })
  );

  // Command: copy + open Claude Code
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-skills-panel.sendToClaude", (command: string) => {
      vscode.env.clipboard.writeText(command).then(() => {
        vscode.commands.executeCommand("claude-vscode.editor.open");
      });
    })
  );

  // Command: refresh local skills
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-skills-panel.refreshSkills", () => {
      const skills = getAllSkills();
      vscode.window.showInformationMessage(`🔄 已扫描本地技能，共 ${skills.length} 个技能`);
    })
  );

  // Command: import skill from git URL
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-skills-panel.importSkill", async () => {
      const url = await vscode.window.showInputBox({
        prompt: "输入 GitHub 仓库 URL",
        placeHolder: "https://github.com/obra/superpowers.git",
        validateInput: (value: string) => {
          if (!value.startsWith("http") && !value.startsWith("git@")) {
            return "请输入有效的仓库 URL";
          }
          return null;
        },
      });
      if (!url) return;

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "正在导入技能..." },
        async () => {
          const result = importSkillFromGit(url);
          if (result.success) {
            vscode.window.showInformationMessage(`✅ ${result.message}`);
          } else {
            vscode.window.showErrorMessage(result.message);
          }
          return result;
        }
      );
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up - subscriptions auto-dispose
}
