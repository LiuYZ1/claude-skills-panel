import * as fs from "fs";
import * as path from "path";
import { execSync, execFile } from "child_process";

export interface SkillItem {
  command: string;
  label: string;
  description: string;
  group: string;
  source?: "builtin" | "local";
  labelCn?: string;
  descCn?: string;
  alias?: string;
  tags?: string[];
}

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "C:\\Users\\Administrator";

// ---- Translation Cache ----
const TRANS_CACHE_FILE = path.join(HOME_DIR, ".claude", "skills-translations.json");

function loadTranslationCache(): Record<string, { labelCn?: string; descCn: string }> {
  try {
    if (fs.existsSync(TRANS_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TRANS_CACHE_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveTranslationCache(cache: Record<string, { labelCn?: string; descCn: string }>): void {
  try {
    const dir = path.dirname(TRANS_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRANS_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}

// ---- Claude API Translation ----
// Read API config from Claude settings
function getApiConfig(): { apiKey: string; baseUrl: string; model: string } {
  try {
    const settingsPath = path.join(HOME_DIR, ".claude", "settings.json");
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      const env = settings.env || {};
      return {
        apiKey: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
        baseUrl: (env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, ""),
        model: env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      };
    }
  } catch {}
  return { apiKey: "", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" };
}

export async function translateSkill(command: string, label: string, description: string): Promise<{ labelCn?: string; descCn: string } | null> {
  const cache = loadTranslationCache();
  if (cache[command]) return cache[command];

  // Find the CLI script (compiled JS next to this file)
  const scriptPath = path.join(__dirname, "translate-cli.js");

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`翻译脚本未找到: ${scriptPath}`);
  }

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath, // Use the same Node.js
        [scriptPath, command, label, description],
        {
          timeout: 60000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env }, // Pass through all env vars
        },
        (error, stdout, stderr) => {
          if (error) {
            const errMsg = stderr || error.message;
            reject(new Error(errMsg.trim()));
            return;
          }
          resolve(stdout.trim());
        }
      );
    });

    // Parse the JSON result
    const parsed = JSON.parse(result);
    const translation: { labelCn?: string; descCn: string } = {
      descCn: parsed.descCn || description,
    };
    // Only set labelCn if the API returned one (newer versions don't)
    if (parsed.labelCn) translation.labelCn = parsed.labelCn;

    // Cache it
    cache[command] = translation;
    saveTranslationCache(cache);

    return { labelCn: translation.labelCn || label, descCn: translation.descCn };
  } catch (err: any) {
    throw new Error(`翻译失败: ${err.message || err}`);
  }
}

export function hasTranslation(command: string): boolean {
  return !!loadTranslationCache()[command];
}

// ---- Translation Dictionary (fallback for quick display) ----
const EN_CN_MAP: Record<string, string> = {
  "test": "测试", "development": "开发", "debug": "调试", "review": "审查",
  "code": "代码", "design": "设计", "plan": "计划", "build": "构建",
  "deploy": "部署", "deployment": "部署", "release": "发布", "security": "安全",
  "performance": "性能", "optimization": "优化", "migration": "迁移",
  "integration": "集成", "documentation": "文档", "monitoring": "监控",
  "analysis": "分析", "analytics": "分析", "report": "报告", "search": "搜索",
  "workflow": "工作流", "pipeline": "管道", "automation": "自动化",
  "architecture": "架构", "pattern": "模式", "framework": "框架",
  "database": "数据库", "api": "接口", "frontend": "前端", "backend": "后端",
  "fullstack": "全栈", "mobile": "移动端", "web": "网页", "cli": "命令行",
  "service": "服务", "microservice": "微服务", "container": "容器",
  "config": "配置", "configuration": "配置", "management": "管理",
  "template": "模板", "generator": "生成器", "scaffold": "脚手架",
  "quality": "质量", "coverage": "覆盖率", "lint": "代码检查",
  "refactor": "重构", "cleanup": "清理", "format": "格式化",
  "commit": "提交", "branch": "分支", "merge": "合并", "rebase": "变基",
  "version": "版本", "changelog": "变更日志", "tag": "标签",
  "style": "样式", "theme": "主题", "responsive": "响应式",
  "auth": "认证", "login": "登录", "permission": "权限",
  "error": "错误", "exception": "异常", "logging": "日志",
  "cache": "缓存", "session": "会话", "queue": "队列",
  "notification": "通知", "email": "邮件", "sms": "短信",
  "backup": "备份", "recovery": "恢复", "disaster": "灾难",
  "feature": "功能", "fix": "修复", "patch": "补丁", "hotfix": "热修复",
  "upgrade": "升级", "update": "更新", "install": "安装",
  "remove": "移除", "delete": "删除", "add": "添加", "create": "创建",
  "read": "读取", "write": "写入", "execute": "执行",
  "validate": "验证", "verify": "验证", "check": "检查",
  "generate": "生成", "convert": "转换", "transform": "变换",
  "parse": "解析", "extract": "提取", "load": "加载",
  "import": "导入", "export": "导出", "sync": "同步",
  "start": "启动", "stop": "停止", "restart": "重启", "run": "运行",
  "compile": "编译", "pack": "打包",
  "guide": "指南", "tutorial": "教程", "example": "示例",
  "advanced": "高级", "basic": "基础", "intermediate": "中级",
  "beginner": "入门", "expert": "专家",
  "tool": "工具", "utility": "实用工具", "helper": "辅助",
  "best practice": "最佳实践", "principle": "原则",
  "strategy": "策略", "method": "方法", "approach": "方法",
  "thinking": "思考", "brainstorm": "头脑风暴", "decision": "决策",
  "skill": "技能", "agent": "智能体", "subagent": "子智能体",
  "hook": "钩子", "plugin": "插件", "extension": "扩展",
  "superpowers": "超能力", "brainstorming": "头脑风暴",
  "dispatching": "调度", "parallel": "并行",
  "executing": "执行", "finishing": "完成", "receiving": "接收",
  "requesting": "请求", "driven": "驱动", "systematic": "系统化",
  "verification": "验证", "completion": "完成",
  "git": "Git", "worktree": "工作树", "worktrees": "工作树",
  "using": "使用", "writing": "编写",
  "cynefin": "Cynefin决策", "eisenhower": "艾森豪威尔矩阵",
  "feynman": "费曼学习法", "moscow": "莫斯科优先级",
  "ooda": "OODA循环", "postmortem": "事后复盘",
  "premortem": "事前预演", "redteam": "红队测试",
  "retro": "回顾", "rice": "RICE评分", "scamper": "SCAMPER创新",
  "sixhats": "六顶思考帽", "socratic": "苏格拉底提问",
  "swot": "SWOT分析", "wardley": "Wardley地图", "wrap": "WRAP决策",
  "aar": "行动后反思", "jtbd": "JTBD任务", "eos": "EOS框架",
  "angular": "Angular", "billing": "计费", "cost": "成本",
  "dependency": "依赖", "token": "令牌", "blockchain": "区块链",
  "smart contract": "智能合约", "solidity": "Solidity",
  "helm": "Helm", "kubernetes": "K8s", "k8s": "K8s",
  "terraform": "Terraform", "prometheus": "Prometheus",
  "grafana": "Grafana",
  "awesome": "精选", "curated": "精选",
};

// Quick dictionary-based translation for initial display
function quickTranslate(text: string): string {
  const lower = text.toLowerCase();
  if (EN_CN_MAP[lower]) return EN_CN_MAP[lower];
  const words = lower.split(/[\s\-_]+/);
  const parts: string[] = [];
  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z]/g, "");
    if (EN_CN_MAP[cleaned]) parts.push(EN_CN_MAP[cleaned]);
  }
  return parts.join("");
}

export function isEnglish(text: string): boolean {
  // If it contains Chinese characters, it's not English-only
  if (/[一-鿿]/.test(text)) return false;
  // If it contains mostly ASCII letters, it's English
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length > 0 && letters.length / Math.max(text.length, 1) > 0.3;
}

export function getQuickCnLabel(label: string, command: string): string {
  if (/[一-鿿]/.test(label)) return "";
  const cache = loadTranslationCache();
  if (cache[command]?.labelCn) return cache[command].labelCn;
  const t = quickTranslate(label);
  if (t) return t;
  const cmdParts = command.replace(/^[/\\]/, "").split(/[/\\]/).pop() || command;
  return quickTranslate(cmdParts.replace(/[-_]/g, " "));
}

export function getQuickCnDesc(description: string, label: string): string {
  if (/[一-鿿]/.test(description)) return "";
  const t = quickTranslate(description);
  return t || "";
}

// ---- Alias Management ----
const ALIAS_FILE = path.join(HOME_DIR, ".claude", "skills-aliases.json");

function getAliases(): Record<string, string> {
  try {
    if (fs.existsSync(ALIAS_FILE)) return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf-8"));
  } catch {}
  return {};
}

function saveAliases(aliases: Record<string, string>): void {
  try {
    const dir = path.dirname(ALIAS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2), "utf-8");
  } catch {}
}

export function setAlias(command: string, alias: string): void {
  const aliases = getAliases();
  if (alias.trim()) aliases[command] = alias.trim();
  else delete aliases[command];
  saveAliases(aliases);
}

export function removeAlias(command: string): void {
  const aliases = getAliases();
  delete aliases[command];
  saveAliases(aliases);
}

// ---- Remove Skill ----
export function removeLocalSkill(command: string): { success: boolean; message: string } {
  try {
    const skillsDir = path.join(HOME_DIR, ".claude", "skills");
    const targetDir = path.join(skillsDir, command);
    if (!fs.existsSync(targetDir)) return { success: false, message: `技能 ${command} 不存在` };
    fs.rmSync(targetDir, { recursive: true, force: true });
    removeAlias(command);
    return { success: true, message: `✅ ${command} 已移除` };
  } catch (err: any) {
    return { success: false, message: `移除失败: ${err.message || err}` };
  }
}

// ---- Built-in skills ----
export const BUILTIN_SKILLS: SkillItem[] = [
  { command: "code-review",     label: "代码审查",     description: "审查代码正确性，查找 bug",              group: "分析", source: "builtin" },
  { command: "review",          label: "审查 PR",      description: "审查拉取请求的改动",                    group: "分析", source: "builtin" },
  { command: "security-review", label: "安全审查",     description: "对代码进行安全漏洞审查",                group: "分析", source: "builtin" },
  { command: "verify",          label: "验证功能",     description: "运行应用并验证功能是否正常",            group: "分析", source: "builtin" },
  { command: "deep-research",   label: "深度研究",     description: "多源搜索、事实核查、生成引用报告",      group: "分析", source: "builtin" },
  { command: "simplify",        label: "代码简化",     description: "优化简化代码，提高可维护性",            group: "代码", source: "builtin" },
  { command: "run",             label: "启动应用",     description: "启动项目应用，查看运行效果",            group: "代码", source: "builtin" },
  { command: "init",            label: "初始化文档",   description: "初始化项目 CLAUDE.md 文档",             group: "代码", source: "builtin" },
  { command: "claude-api",      label: "API 查询",     description: "查询 Claude API 参考文档",              group: "代码", source: "builtin" },
  { command: "loop",            label: "循环执行",     description: "定时重复执行任务或命令",                group: "工具", source: "builtin" },
  { command: "update-config",   label: "修改配置",     description: "配置 Claude Code 设置",                 group: "工具", source: "builtin" },
  { command: "fewer-permission-prompts", label: "减少权限提示", description: "优化权限设置，减少弹窗",      group: "工具", source: "builtin" },
  { command: "keybindings-help",label: "快捷键帮助",   description: "自定义键盘快捷键绑定",                  group: "工具", source: "builtin" },
];

// ---- SKILL.md parser ----
function parseSkillMd(filePath: string): { name: string; description: string; group: string; body: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let inFrontmatter = false;
    let frontmatterEnd = -1;
    let currentKey = "";
    let currentIndent = 0;
    const frontmatter: Record<string, string> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === "---") {
        if (!inFrontmatter) { inFrontmatter = true; continue; }
        else { frontmatterEnd = i; break; }
      }
      if (!inFrontmatter) continue;

      // Check if this line starts a new key (no leading space)
      if (!line.startsWith(" ") && !line.startsWith("\t")) {
        const sepIdx = trimmed.indexOf(":");
        if (sepIdx > 0) {
          currentKey = trimmed.slice(0, sepIdx).trim();
          const val = trimmed.slice(sepIdx + 1).trim();
          frontmatter[currentKey] = val;
          // Track indentation for multi-line values
          currentIndent = line.search(/\S/);
          continue;
        }
      }

      // Continuation of multi-line value (indented lines after a key)
      if (currentKey && line.trim()) {
        const lineIndent = line.search(/\S/);
        if (lineIndent > currentIndent && inFrontmatter) {
          frontmatter[currentKey] += "\n" + trimmed;
        }
      }
    }

    // Read body text (after frontmatter) for richer classification context
    let bodyText = "";
    if (frontmatterEnd > 0) {
      bodyText = lines.slice(frontmatterEnd + 1).filter((l: string) => !l.trim().startsWith("```") && !l.trim().startsWith("#") && l.trim()).slice(0, 15).join(" ").slice(0, 500);
    }

    // Clean up description
    let description = frontmatter["description"] || "";
    // Handle YAML block scalars
    description = description.replace(/^>\s*-?\s*/g, "").replace(/^\|\s*/g, "").trim();

    const name = frontmatter["name"];
    if (!name) {
      const dirName = path.basename(path.dirname(filePath));
      return { name: dirName, description: description || dirName, group: frontmatter["group"] || "自定义", body: bodyText || description };
    }
    return { name, description: description || name, group: frontmatter["group"] || "自定义", body: bodyText || description };
  } catch { return null; }
}

function findSkillFiles(dir: string): string[] {
  const results: string[] = [];
  try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) results.push(...findSkillFiles(f)); else if (e.name.toLowerCase() === "skill.md") results.push(f); } } catch {}
  return results;
}

function toLabel(str: string): string {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- Scan local skills ----
export function scanLocalSkills(): SkillItem[] {
  const skillsDir = path.join(HOME_DIR, ".claude", "skills");
  const localSkills: SkillItem[] = [];
  if (!fs.existsSync(skillsDir)) return localSkills;
  const cache = loadTranslationCache();
  try {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillFiles = findSkillFiles(skillDir);
      if (skillFiles.length === 0) {
        localSkills.push({ command: entry.name, label: toLabel(entry.name), description: `本地技能: ${entry.name}`, group: "本地安装", source: "local" });
        continue;
      }
      for (const sf of skillFiles) {
        const parsed = parseSkillMd(sf);
        if (parsed) {
          const cmd = path.relative(skillsDir, path.dirname(sf)).replace(/\\/g, "/");
          const label = toLabel(parsed.name);
          // Use body for description if frontmatter description is empty
          const desc = parsed.description || parsed.body || label;
          const item: SkillItem = { command: cmd, label, description: desc, group: parsed.group || "本地安装", source: "local" };
          // Only show translation from cache (API-based, user-triggered)
          if (isEnglish(label) && cache[cmd]) {
            if (cache[cmd].labelCn) item.labelCn = cache[cmd].labelCn;
            if (cache[cmd].descCn) item.descCn = cache[cmd].descCn;
          }
          localSkills.push(item);
        }
      }
    }
  } catch (err) { console.error("Error scanning local skills:", err); }
  return localSkills;
}

// ---- Get all skills with aliases ----
export function getAllSkills(): SkillItem[] {
  const local = scanLocalSkills();
  const aliases = getAliases();
  const cache = loadTranslationCache();
  const builtin = BUILTIN_SKILLS.filter((b) => !local.some((l) => l.command === b.command));
  // Load tags
  const allTags = loadTags();

  const all = [...builtin, ...local];
  for (const skill of all) {
    if (aliases[skill.command]) skill.alias = aliases[skill.command];
    if (allTags[skill.command]) skill.tags = allTags[skill.command];
    // Apply cached translations
    if (cache[skill.command] && isEnglish(skill.label)) {
      if (cache[skill.command].labelCn) skill.labelCn = cache[skill.command].labelCn;
      if (cache[skill.command].descCn) skill.descCn = cache[skill.command].descCn;
    }
  }
  return all;
}

// ---- AI Classification ----
const CLASSIFY_CACHE_FILE = path.join(HOME_DIR, ".claude", "skills-classify.json");

function loadClassifyCache(): Record<string, string> {
  try {
    if (fs.existsSync(CLASSIFY_CACHE_FILE)) return JSON.parse(fs.readFileSync(CLASSIFY_CACHE_FILE, "utf-8"));
  } catch {}
  return {};
}

function saveClassifyCache(cache: Record<string, string>): void {
  try {
    const dir = path.dirname(CLASSIFY_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CLASSIFY_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}

export function classifySkills(skills: SkillItem[]): Promise<Record<string, string>> {
  const scriptPath = path.join(__dirname, "classify-cli.js");
  if (!fs.existsSync(scriptPath)) throw new Error("分类脚本未找到");

  // Load existing classifications
  const existing = loadClassifyCache();

  // Classify unclassified skills (include all, even non-English descriptions)
  const toClassify = skills
    .filter(s => !existing[s.command] && (s.description || s.label))
    .slice(0, 15)
    .map(s => ({
      command: s.command,
      label: s.label || s.command,
      description: (s.description || s.label).replace(/[\n\r]+/g, " ").slice(0, 300),
    }));

  if (toClassify.length === 0) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");
    const child = spawn(process.execPath, [scriptPath], {
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("error", (err: Error) => reject(new Error(err.message)));
    child.on("close", (code: number) => {
      if (code !== 0) {
        reject(new Error(stderr || ("退出码 " + code)));
        return;
      }
      try {
        const newResults = JSON.parse(stdout.trim());
        const merged = { ...existing, ...newResults };
        saveClassifyCache(merged);
        resolve(merged);
      } catch (e: any) {
        reject(new Error("解析失败: " + stdout.slice(0, 100)));
      }
    });

    child.stdin.write(JSON.stringify(toClassify));
    child.stdin.end();
  });
}

export function getAIClassifications(): Record<string, string> {
  return loadClassifyCache();
}

export type GroupMode = "tag" | "ai";

// ---- Tag Management ----
const TAG_FILE = path.join(HOME_DIR, ".claude", "skills-tags.json");

function loadTags(): Record<string, string[]> {
  try {
    if (fs.existsSync(TAG_FILE)) return JSON.parse(fs.readFileSync(TAG_FILE, "utf-8"));
  } catch {}
  return {};
}

function saveTags(tags: Record<string, string[]>): void {
  try {
    const dir = path.dirname(TAG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TAG_FILE, JSON.stringify(tags, null, 2), "utf-8");
  } catch {}
}

export function getSkillTags(): Record<string, string[]> {
  return loadTags();
}

export function setSkillTag(command: string, tag: string): void {
  const tags = loadTags();
  if (!tags[command]) tags[command] = [];
  const idx = tags[command].indexOf(tag);
  if (idx >= 0) tags[command].splice(idx, 1); else tags[command].push(tag);
  if (tags[command].length === 0) delete tags[command];
  saveTags(tags);
}

export function setSkillTagsBulk(commands: string[], tag: string): void {
  const tags = loadTags();
  for (const cmd of commands) {
    if (!tags[cmd]) tags[cmd] = [];
    if (!tags[cmd].includes(tag)) tags[cmd].push(tag);
  }
  saveTags(tags);
}

export function removeSkillTag(command: string, tag: string): void {
  const tags = loadTags();
  if (tags[command]) {
    tags[command] = tags[command].filter(t => t !== tag);
    if (tags[command].length === 0) delete tags[command];
    saveTags(tags);
  }
}

export function getAllTags(): string[] {
  const tags = loadTags();
  const allTags = new Set<string>();
  for (const cmdTags of Object.values(tags)) cmdTags.forEach(t => allTags.add(t));
  return Array.from(allTags).sort();
}

// Get source directory for a skill
function getSkillDir(command: string, source?: string): string {
  if (source !== "local") return "Claude Code 原生";
  if (command.startsWith("superpowers")) return "📦 superpowers";
  if (command.startsWith("agent-skills")) return "📦 agent-skills";
  if (command.startsWith("kaijutale")) return "📦 kaijutale";
  if (command.startsWith("awesome")) return "📦 awesome-skills";
  return "📦 其他来源";
}

// Group skills by the selected mode
export function groupSkills(skills: SkillItem[], mode: GroupMode): Record<string, SkillItem[]> {
  const groups: Record<string, SkillItem[]> = {};

  for (const skill of skills) {
    let keys: string[];
    switch (mode) {
      case "tag":
        keys = skill.tags && skill.tags.length > 0 ? skill.tags.map(t => `🏷️ ${t}`) : ["🏷️ 未标记"];
        break;
      case "ai":
      default:
        var classify = loadClassifyCache();
        var cat = classify[skill.command];
        keys = [cat ? `🤖 ${cat}` : "🤖 未分类"];
        break;
    }
    for (const key of keys) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(skill);
    }
  }
  return groups;
}

// ---- Import skill from git ----
export function importSkillFromGit(url: string): { success: boolean; message: string; name?: string } {
  try {
    const repoName = url.replace(/\.git$/, "").split("/").pop();
    if (!repoName) return { success: false, message: "无法从URL中提取仓库名" };
    const skillsDir = path.join(HOME_DIR, ".claude", "skills");
    const targetDir = path.join(skillsDir, repoName);
    if (fs.existsSync(targetDir)) return { success: false, message: `技能 ${repoName} 已存在` };
    fs.mkdirSync(skillsDir, { recursive: true });
    execSync(`git clone "${url}" "${targetDir}"`, { timeout: 60000, stdio: "pipe" });
    return { success: true, message: `✅ ${repoName} 导入成功`, name: repoName };
  } catch (err: any) {
    return { success: false, message: `导入失败: ${err.message || err}` };
  }
}
