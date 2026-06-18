import * as vscode from "vscode";
import { getAllSkills, importSkillFromGit, removeLocalSkill, setAlias, translateSkill, setSkillTag, getSkillTags, getAllTags, getAIClassifications, classifySkills, SkillItem, GroupMode } from "./skillsData";
import { getWebviewContent } from "./htmlTemplate";

export class SkillsPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "claudeSkillsPanelSidebar";

  private _view?: vscode.WebviewView;
  private _skills: SkillItem[] = [];
  private _groupMode: GroupMode = "tag";

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._skills = getAllSkills();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    this._render();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "skillClicked":
          this._handleCopyOnly(message.command as string);
          break;
        case "skillClickedAndOpen":
          this._handleSkillClick(message.command as string);
          break;
        case "refreshSkills":
          this._handleRefresh();
          break;
        case "importSkill":
          this._handleImport(message.url as string);
          break;
        case "setAlias":
          this._handleSetAlias(message.command as string, message.alias as string);
          break;
        case "removeSkill":
          this._handleRemove(message.command as string);
          break;
        case "translateSkill":
          this._handleTranslate(message.command as string, message.label as string, message.description as string);
          break;
        case "viewSkillFile":
          this._handleViewFile(message.command as string);
          break;
        case "classifySkills":
          this._handleClassify();
          break;
        case "setSkillTag":
          this._handleSetSkillTag(message.command as string);
          break;
        case "changeGroupMode":
          this._groupMode = message.mode as GroupMode;
          this._render();
          break;
        case "reloadWebview":
          this._render();
          break;
      }
    });
  }

  private _render(): void {
    if (!this._view) return;
    this._skills = getAllSkills();
    this._view.webview.html = getWebviewContent(this._skills, this._view.webview.cspSource, this._groupMode);
  }

  private _handleCopyOnly(cmd: string): void {
    vscode.env.clipboard.writeText(cmd);
  }

  private _handleSkillClick(cmd: string): void {
    vscode.env.clipboard.writeText(cmd).then(() => {
      vscode.commands.executeCommand("claude-vscode.focus").then(
        () => vscode.window.showInformationMessage(`📋 已复制 ${cmd}，在 Claude Code 中 Ctrl+V 粘贴后回车执行`),
        () => vscode.window.showWarningMessage(`📋 已复制 ${cmd}，请到 Claude Code 聊天框中 Ctrl+V 粘贴后按回车`)
      );
    });
  }

  private _handleRefresh(): void {
    try {
      const updated = getAllSkills();
      this._skills = updated;
      this._render();
      this._postMessage({ type: "updateSkills", count: updated.length });
      vscode.window.showInformationMessage(`🔄 技能已刷新，共 ${updated.length} 个技能`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`刷新失败: ${err.message}`);
      this._postMessage({ type: "refreshResult", success: false, message: `刷新失败: ${err.message}` });
    }
  }

  private async _handleClassify(): Promise<void> {
    try {
      const existingCount = Object.keys(getAIClassifications()).length;
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "🧠 AI 正在分析技能用途并分类..." },
        () => classifySkills(this._skills)
      );
      const newCount = Object.keys(result).length;
      const added = newCount - existingCount;
      // Auto-switch to AI classification mode
      this._groupMode = "ai";
      this._render();
      if (added > 0) {
        vscode.window.showInformationMessage(`🧠 本次新增分类 ${added} 个，共 ${newCount} 个！已自动切换到 AI 分类模式`);
      } else {
        vscode.window.showInformationMessage(`🎉 所有 ${newCount} 个技能已分类完毕！`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`AI 分类失败: ${err.message}`);
    }
  }

  private _handleImport(url: string): void {
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "正在导入技能..." },
      async () => {
        const result = importSkillFromGit(url);
        this._postMessage({ type: "importResult", ...result });
        if (result.success) this._handleRefresh();
        return result;
      }
    );
  }

  private _handleSetAlias(command: string, alias: string): void {
    try {
      setAlias(command, alias);
      this._render();
      this._postMessage({ type: "aliasResult", success: true });
      vscode.window.showInformationMessage(alias ? `✅ 别名已设置: ${command} → ${alias}` : `✅ 别名已清除: ${command}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`设置别名失败: ${err.message}`);
    }
  }

  private async _handleTranslate(command: string, label: string, description: string): Promise<void> {
    try {
      const result = await translateSkill(command, label, description);
      if (result) {
        this._render();
        vscode.window.showInformationMessage(`🌐 翻译完成: ${label} → ${result.labelCn}`);
      } else {
        vscode.window.showErrorMessage(`翻译失败，请检查 API 配置`);
        this._postMessage({ type: "refreshResult", success: false, message: "翻译失败" });
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`翻译失败: ${err.message}`);
    }
  }

  private _handleViewFile(command: string): void {
    const cleanCmd = command.replace(/^\//, "");
    const homeDir = process.env.HOME || process.env.USERPROFILE || "C:\\Users\\Administrator";
    const possiblePaths = [
      require("path").join(homeDir, ".claude", "skills", cleanCmd, "SKILL.md"),
      require("path").join(homeDir, ".claude", "skills", cleanCmd, "skill.md"),
      require("path").join(homeDir, ".claude", "skills", cleanCmd.split("/")[0], "SKILL.md"),
    ];
    for (const filePath of possiblePaths) {
      if (require("fs").existsSync(filePath)) {
        vscode.workspace.openTextDocument(filePath).then((doc) => {
          vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
        });
        return;
      }
    }
    vscode.window.showWarningMessage(`未找到技能文件: ${cleanCmd}`);
  }

  private async _handleSetSkillTag(command: string): Promise<void> {
    const allTags = getAllTags();
    const currentTags = getSkillTags()[command] || [];
    const tag = await vscode.window.showInputBox({
      prompt: `为 ${command} 设置标签（已有: ${currentTags.join(", ") || "无"}）`,
      placeHolder: "输入标签名，已存在的标签会移除，新标签会添加",
      ignoreFocusOut: true,
    });
    if (tag !== undefined) {
      setSkillTag(command, tag.trim());
      this._render();
      vscode.window.showInformationMessage(`🏷️ 标签已更新: ${command}`);
    }
  }

  private _handleRemove(command: string): void {
    const result = removeLocalSkill(command.replace(/^\//, ""));
    this._postMessage({ type: "removeResult", ...result });
    if (result.success) {
      vscode.window.showInformationMessage(result.message);
      this._handleRefresh();
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  private _postMessage(msg: any): void {
    try { this._view?.webview.postMessage(msg); } catch {}
  }
}
