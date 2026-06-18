import { SkillItem, isEnglish, groupSkills, GroupMode } from "./skillsData";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) { const k = keyFn(item); if (!map[k]) map[k] = []; map[k].push(item); }
  return map;
}

export function getWebviewContent(skills: SkillItem[], cspSource: string, groupMode: GroupMode = "tag"): string {
  // Group skills by the selected mode
  const groups = groupSkills(skills, groupMode);
  const groupEntries = Object.entries(groups);

  const cardsHtml = groupEntries.map(([groupName, items]) => {
    const itemCards = items.map((skill) => {
      const displayLabel = skill.alias || skill.labelCn || skill.label;
      const hasTranslation = skill.labelCn && skill.labelCn !== skill.label && !skill.alias;
      const hasDescCn = skill.descCn && skill.descCn !== skill.description;
      const needsTrans = isEnglish(skill.description);
      const isLocal = skill.source === "local";
      const sourceDir = isLocal ? (skill.command.startsWith("superpowers") ? "superpowers" : skill.command.startsWith("agent-skills") ? "agent-skills" : skill.command.startsWith("awesome") ? "awesome" : skill.command.startsWith("kaijutale") ? "kaijutale" : "其他") : "claude-code";

      return `
      <div class="skill-card" data-cmd="/${escapeHtml(skill.command)}" data-label="${escapeHtml(skill.label)}" data-desc="${escapeHtml(skill.description)}" data-group="${escapeHtml(skill.group)}" data-source="${skill.source || "builtin"}" data-dir="${escapeHtml(sourceDir)}" data-alias="${escapeHtml(skill.alias || "")}">
        <div class="skill-label-row">
          <span class="skill-label">${escapeHtml(displayLabel)}</span>
          ${skill.alias ? `<span class="skill-original">${escapeHtml(skill.label)}</span>` : (hasTranslation ? `<span class="skill-label-en">${escapeHtml(skill.label)}</span>` : "")}
        </div>
        ${skill.alias ? `<div class="skill-original-cmd">/${escapeHtml(skill.command)}</div>` : `<div class="skill-command">/${escapeHtml(skill.command)}</div>`}
        <div class="skill-desc">
          ${hasDescCn
            ? `<span class="desc-en">${escapeHtml(skill.description)}</span><span class="desc-cn">${escapeHtml(skill.descCn || "")}</span>`
            : `<span class="desc-en">${escapeHtml(skill.description)} ${needsTrans ? '<button class="desc-trans-btn" data-cmd="' + escapeHtml(skill.command) + '" data-label="' + escapeHtml(skill.label) + '" data-desc="' + escapeHtml(skill.description) + '" title="翻译描述">🌐</button>' : ''}</span>`}
        </div>
        ${skill.tags && skill.tags.length > 0 ? `<div class="skill-tags">${skill.tags.map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        <div class="skill-actions">
          <button class="card-btn tag-btn" data-cmd="${escapeHtml(skill.command)}" title="标记">🏷️</button>
          <button class="card-btn view-btn" data-cmd="${escapeHtml(skill.command)}" title="查看文件">📄</button>
          <button class="card-btn alias-btn" data-cmd="${escapeHtml(skill.command)}" data-label="${escapeHtml(skill.label)}" title="别名">✎</button>
          ${isLocal ? '<button class="card-btn remove-btn" data-cmd="' + escapeHtml(skill.command) + '" title="移除">✕</button>' : ''}
        </div>
      </div>`;
    }).join("\n");

    const collapsed = groupName !== "分析" && groupName !== "代码"; // expand first two groups by default
    return `
    <div class="group-section ${collapsed ? 'collapsed' : ''}" data-group="${escapeHtml(groupName)}">
      <div class="group-header" data-toggle>
        <svg class="group-arrow" width="10" height="10" viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        <span class="group-name" data-filter-group="${escapeHtml(groupName)}">${escapeHtml(groupName)}</span>
        <span class="group-count">${items.length}</span>
      </div>
      <div class="card-grid" style="${collapsed ? 'display:none' : ''}">${itemCards}</div>
    </div>`;
  }).join("\n");

  // Available tags for filter
  var allTagSet = new Set<string>();
  skills.forEach(function(s) { if (s.tags) s.tags.forEach(function(t) { allTagSet.add(t); }); });
  const tagKeys = Array.from(allTagSet);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, #1e1e1e);
      --card-bg: var(--vscode-editor-background, #252526);
      --border: var(--vscode-widget-border, #3c3c3c);
      --text: var(--vscode-editor-foreground, #cccccc);
      --text-secondary: var(--vscode-descriptionForeground, #9d9d9d);
      --accent: var(--vscode-textLink-foreground, #3794ff);
      --group-header: var(--vscode-editorWidget-foreground, #aaaaaa);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-border: var(--vscode-input-border, #555555);
      --input-focus: var(--vscode-focusBorder, #007acc);
      --btn-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --btn-gradient3: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-text: var(--vscode-badge-foreground, #ffffff);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg); color: var(--text); padding: 12px; font-size: 13px; line-height: 1.5;
    }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; }
    .header-left { display: flex; align-items: center; gap: 8px; }
    .header-icon { font-size: 18px; }
    .header-title { font-size: 14px; font-weight: 700; }
    .header-actions { display: flex; gap: 6px; }
    .action-btn { width: 32px; height: 32px; border: none; border-radius: 50%; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.25s; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .action-btn:hover { transform: translateY(-2px) scale(1.05); }
    .action-btn:active { transform: translateY(0) scale(0.95); }
    .action-btn.refresh { background: var(--btn-gradient); }
    .action-btn.import { background: var(--btn-gradient3); }

    /* Filter Chips */
    .filter-bar { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .filter-chip {
      padding: 3px 10px; border: 1px solid var(--border); border-radius: 12px;
      font-size: 11px; cursor: pointer; background: transparent; color: var(--text-secondary);
      transition: all 0.15s;
    }
    .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
    .filter-chip.active { background: var(--accent); color: var(--badge-text); border-color: var(--accent); }

    /* Group Mode Switcher */
    .mode-bar { display: flex; gap: 4px; margin-bottom: 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
    .mode-btn {
      flex: 1; padding: 4px 8px; border: none; border-radius: 6px; font-size: 11px;
      cursor: pointer; background: transparent; color: var(--text-secondary);
      transition: all 0.2s; font-weight: 500;
    }
    .mode-btn:hover { color: var(--text); }
    .mode-btn.active { background: var(--accent); color: white; }

    /* Search */
    .search-container { position: relative; margin-bottom: 8px; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 13px; pointer-events: none; }
    .search-input {
      width: 100%; padding: 7px 10px 7px 32px; font-size: 13px;
      background: var(--input-bg); color: var(--text); border: 1px solid var(--input-border);
      border-radius: 20px; outline: none; transition: all 0.2s;
    }
    .search-input:focus { border-color: var(--input-focus); box-shadow: 0 0 0 2px rgba(55,148,255,0.15); }

    /* Stats */
    .stats-bar { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between; padding: 0 4px; }

    /* Groups - Modern Accordion */
    .group-section { margin-bottom: 6px; border-radius: 10px; overflow: hidden; background: var(--card-bg); border: 1px solid var(--border); transition: border-color 0.2s; }
    .group-section:hover { border-color: var(--accent); }
    .group-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; user-select: none; transition: background 0.15s; }
    .group-header:hover { background: rgba(255,255,255,0.04); }
    .group-arrow { flex-shrink: 0; color: var(--text-secondary); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .group-section:not(.collapsed) .group-arrow { transform: rotate(90deg); }
    .group-name { font-size: 12px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; }
    .group-count { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--text-secondary); background: var(--badge-bg); padding: 1px 8px; border-radius: 10px; min-width: 20px; text-align: center; }
    .group-section.hidden { display: none; }
    /* Cards Grid */
    .card-grid { display: grid; grid-template-columns: 1fr; gap: 4px; padding: 0 6px 6px; }
    @media (min-width: 500px) { .card-grid { grid-template-columns: 1fr 1fr; } }
    .skill-card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;
      padding: 8px; cursor: pointer; position: relative;
      transition: all 0.15s; user-select: none;
    }
    .skill-card:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
    .skill-card:active { transform: translateY(0); }
    .skill-card.hidden { display: none; }
    .skill-label-row { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; padding-right: 4px; margin-bottom: 1px; }
    .skill-label { font-size: 13px; font-weight: 600; }
    .skill-label-en { font-size: 11px; color: var(--accent); opacity: 0.85; font-weight: 400; }
    .skill-original { font-size: 11px; color: var(--accent); opacity: 0.85; font-weight: 400; }
    .skill-original-cmd { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 10px; color: var(--text-secondary); margin-bottom: 3px; }
    .skill-command { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 11px; color: var(--accent); margin-bottom: 3px; }
    .skill-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s; }
    .skill-card:hover .skill-actions { opacity: 1; }
    .card-btn {
      width: 22px; height: 22px; border: none; border-radius: 50%; cursor: pointer;
      font-size: 11px; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; background: rgba(100,126,234,0.2); color: #667eea;
    }
    .card-btn:hover { background: rgba(100,126,234,0.5); color: white; transform: scale(1.15); }
    .card-btn.alias-btn { background: rgba(100,126,234,0.2); color: #667eea; }
    .card-btn.alias-btn:hover { background: rgba(100,126,234,0.5); color: white; }
    .card-btn.remove-btn { background: rgba(245,87,108,0.2); color: #f5576c; }
    .card-btn.remove-btn:hover { background: rgba(245,87,108,0.5); color: white; }
    .card-btn.view-btn { background: rgba(79,172,254,0.2); color: #4facfe; }
    .card-btn.view-btn:hover { background: rgba(79,172,254,0.5); color: white; }
    .card-btn.tag-btn { background: rgba(255,193,7,0.2); color: #ffc107; }
    .card-btn.tag-btn:hover { background: rgba(255,193,7,0.5); color: white; }
    .skill-tags { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 4px; }
    .tag-badge { font-size: 10px; background: rgba(255,193,7,0.15); color: #ffc107; padding: 1px 6px; border-radius: 8px; border: 1px solid rgba(255,193,7,0.2); }
    .skill-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
    .desc-en { display: inline; }
    .desc-cn { display: block; color: var(--text-secondary); opacity: 0.75; font-size: 10px; margin-top: 1px; }
    .desc-trans-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border: none; border-radius: 50%;
      cursor: pointer; font-size: 10px; background: rgba(79,172,254,0.15);
      color: #4facfe; margin-left: 3px; vertical-align: middle;
      transition: all 0.2s;
    }
    .desc-trans-btn:hover { background: rgba(79,172,254,0.5); color: white; transform: scale(1.15); }

    /* Toast */
    #toast {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
      padding: 6px 16px; border-radius: 20px; font-size: 12px;
      opacity: 0; transition: opacity 0.2s; pointer-events: none; white-space: nowrap; z-index: 100;
      background: var(--vscode-inputValidation-infoBackground, #063b61);
      color: var(--vscode-inputValidation-infoForeground, #cccccc);
      border: 1px solid var(--vscode-inputValidation-infoBorder, #007acc);
    }
    #toast.show { opacity: 1; }
    #toast.error { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); border-color: var(--vscode-inputValidation-errorBorder, #be1100); }

    /* Empty */
    .empty-state { text-align: center; padding: 24px; color: var(--text-secondary); font-size: 13px; }

    /* Import Modal */
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); z-index: 200; align-items: center; justify-content: center; }
    .modal-overlay.show { display: flex; }
    .modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 20px; width: 88%; max-width: 340px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .modal h3 { font-size: 15px; margin-bottom: 4px; }
    .modal p { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
    .modal input { width: 100%; padding: 9px 12px; font-size: 13px; margin-bottom: 14px; background: var(--input-bg); color: var(--text); border: 1px solid var(--input-border); border-radius: 8px; outline: none; }
    .modal input:focus { border-color: var(--input-focus); }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .modal-btn { padding: 7px 18px; border: none; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .modal-btn.primary { background: var(--btn-gradient); color: white; box-shadow: 0 2px 8px rgba(102,126,234,0.4); }
    .modal-btn.danger { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
    .modal-btn.danger:hover { transform: translateY(-1px); }
    .modal-btn.primary:hover { transform: translateY(-1px); }
    .modal-btn.secondary { background: var(--border); color: var(--text); }
    .modal-btn.secondary:hover { background: var(--text-secondary); }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="header-icon">⚡</span>
      <span class="header-title">Skills</span>
    </div>
    <div class="header-actions">
      <button class="action-btn refresh" id="refreshBtn">🔄</button>
      <button class="action-btn import" id="importBtn">📥</button>
    </div>
  </div>

  <!-- Filter Chips -->
  <div class="filter-bar" id="filterBar">
    <button class="filter-chip active" data-filter="all">全部 ${skills.length}</button>
    <button class="filter-chip" data-filter="builtin">内置 ${skills.filter(s => s.source === "builtin").length}</button>
    <button class="filter-chip" data-filter="local">本地 ${skills.filter(s => s.source === "local").length}</button>
    ${tagKeys.map(k => `<button class="filter-chip" data-filter="tag:${escapeHtml(k)}">🏷️ ${escapeHtml(k)}</button>`).join("")}
  </div>

  <!-- Group Mode Switcher -->
  <div class="mode-bar">
    <button class="mode-btn ${groupMode === 'tag' ? 'active' : ''}" data-mode="tag">🏷️ 标签</button>
    <button class="mode-btn ${groupMode === 'ai' ? 'active' : ''}" data-mode="ai">🤖 AI分类</button>
    <button class="action-btn" id="classifyBtn" style="width:28px;height:28px;font-size:13px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);" title="AI分析分类">🧠</button>
  </div>

  <div class="search-container">
    <span class="search-icon">🔍</span>
    <input class="search-input" id="searchInput" type="text" placeholder="搜索技能..." autocomplete="off">
  </div>

  <div class="stats-bar">
    <span id="totalCount">共 ${skills.length} 个</span>
    <span id="visibleCount"></span>
  </div>

  <div id="cardsContainer">${cardsHtml}</div>
  <div class="empty-state" id="emptyState" style="display:none">🔍<br>未找到匹配的技能</div>

  <div id="toast"></div>

  <!-- Import Modal -->
  <div class="modal-overlay" id="importModal">
    <div class="modal">
      <h3>📥 导入技能</h3>
      <p>输入 GitHub 仓库 URL</p>
      <input id="importUrl" type="text" placeholder="https://github.com/obra/superpowers.git">
      <div class="modal-actions">
        <button class="modal-btn secondary" id="cancelImport">取消</button>
        <button class="modal-btn primary" id="confirmImport">导入</button>
      </div>
    </div>
  </div>

  <!-- Alias Modal -->
  <div class="modal-overlay" id="aliasModal">
    <div class="modal">
      <h3>✎ 设置别名</h3>
      <p id="aliasSkillName">为技能设置中文别名</p>
      <input id="aliasInput" type="text" placeholder="输入别名..." autocomplete="off">
      <div class="modal-actions">
        <button class="modal-btn secondary" id="clearAlias">清除</button>
        <button class="modal-btn secondary" id="cancelAlias">取消</button>
        <button class="modal-btn primary" id="confirmAlias">保存</button>
      </div>
    </div>
  </div>

  <!-- Remove Confirm Modal -->
  <div class="modal-overlay" id="removeModal">
    <div class="modal">
      <h3>🗑️ 移除技能</h3>
      <p id="removeSkillName">确定要移除吗？</p>
      <div class="modal-actions">
        <button class="modal-btn secondary" id="cancelRemove">取消</button>
        <button class="modal-btn danger" id="confirmRemove">确认移除</button>
      </div>
    </div>
  </div>

  <!-- Tag Modal -->
  <div class="modal-overlay" id="tagModal">
    <div class="modal">
      <h3>🏷️ 设置标签</h3>
      <p id="tagSkillName">为技能设置标签</p>
      <div id="tagList" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px"></div>
      <div style="display:flex;gap:6px">
        <input id="tagInput" type="text" placeholder="输入新标签..." autocomplete="off" style="flex:1;padding:7px 10px;font-size:13px;background:var(--input-bg);color:var(--text);border:1px solid var(--input-border);border-radius:6px;outline:none">
        <button class="modal-btn primary" id="addTagBtn" style="padding:7px 14px">添加</button>
      </div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="modal-btn secondary" id="cancelTag">关闭</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const toast = document.getElementById('toast');
      let toastTimer = null;

      function showToast(msg, isErr) {
        toast.textContent = msg;
        toast.className = isErr ? 'error' : '';
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
      }

      // ====== Collapsible Groups + State Persistence ======
      function saveExpandState() {
        const state = { expanded: [] };
        document.querySelectorAll('.group-section').forEach(function(s) {
          if (!s.classList.contains('collapsed')) {
            state.expanded.push(s.getAttribute('data-group'));
          }
        });
        vscode.setState(state);
      }

      function restoreExpandState() {
        const state = vscode.getState();
        if (!state || !state.expanded) return;
        document.querySelectorAll('.group-section').forEach(function(s) {
          const name = s.getAttribute('data-group');
          if (state.expanded.includes(name)) {
            s.classList.remove('collapsed');
            const grid = s.querySelector('.card-grid');
            if (grid) grid.style.display = '';
          }
        });
      }

      document.querySelectorAll('.group-header[data-toggle]').forEach(function(header) {
        header.addEventListener('click', function() {
          const section = this.closest('.group-section');
          const grid = section.querySelector('.card-grid');
          const isCollapsed = section.classList.contains('collapsed');
          if (isCollapsed) {
            grid.style.display = '';
            section.classList.remove('collapsed');
          } else {
            grid.style.display = 'none';
            section.classList.add('collapsed');
          }
          saveExpandState();
        });
      });
      restoreExpandState();

      // ====== Filter Chips ======
      let activeFilter = 'all';
      document.querySelectorAll('.filter-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
          this.classList.add('active');
          activeFilter = this.getAttribute('data-filter');
          applyFilters();
        });
      });

      function applyFilters() {
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        let visible = 0;
        document.querySelectorAll('.skill-card').forEach(function(card) {
          const source = card.getAttribute('data-source');
          const dir = card.getAttribute('data-dir');
          const label = card.getAttribute('data-label').toLowerCase();
          const cmd = card.getAttribute('data-cmd').toLowerCase();
          const desc = card.getAttribute('data-desc').toLowerCase();
          const alias = (card.getAttribute('data-alias') || '').toLowerCase();
          let pass = true;
          if (activeFilter === 'builtin') pass = (source === 'builtin');
          else if (activeFilter === 'local') pass = (source === 'local');
          else if (activeFilter.startsWith('dir:')) pass = (dir === activeFilter.slice(4));
          else if (activeFilter.startsWith('group:')) pass = (card.getAttribute('data-group') === activeFilter.slice(6));
          else if (activeFilter.startsWith('group:')) {
            var targetGroup = activeFilter.slice(6);
            pass = (card.getAttribute('data-group') === targetGroup);
          }
          if (pass && query) pass = (label.includes(query) || cmd.includes(query) || desc.includes(query) || alias.includes(query));
          card.classList.toggle('hidden', !pass);
          if (pass) visible++;
        });
        document.querySelectorAll('.group-section').forEach(function(g) {
          const vc = g.querySelectorAll('.skill-card:not(.hidden)').length;
          var cb = g.querySelector('.group-count');
          if (cb) cb.textContent = vc;
          if (vc === 0) { g.classList.add('collapsed'); var grid = g.querySelector('.card-grid'); if (grid) grid.style.display = 'none'; }
        });
        var emptyState = document.getElementById('emptyState');
        if (visible === 0) {
          emptyState.innerHTML = '🔍<br>没有匹配的技能'; emptyState.style.display = 'block';
        } else { emptyState.style.display = 'none'; }
      }
      document.getElementById('searchInput').addEventListener('input', applyFilters);

      // ====== Group Mode Switcher ======
      document.querySelectorAll('.mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          vscode.postMessage({ type: 'changeGroupMode', mode: this.getAttribute('data-mode') });
        });
      });

      // ====== Click Card = Copy ======
      document.querySelectorAll('.skill-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.desc-trans-btn') || e.target.closest('.card-btn')) return;
          vscode.postMessage({ type: 'skillClicked', command: this.getAttribute('data-cmd') });
          showToast('📋 已复制 ' + this.getAttribute('data-cmd'));
          showToast('📋 已复制');
        });
      });

      // ====== Translate ======
      document.querySelectorAll('.desc-trans-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          btn.textContent = '⏳';
          vscode.postMessage({ type: 'translateSkill', command: btn.getAttribute('data-cmd'), label: btn.getAttribute('data-label'), description: btn.getAttribute('data-desc') });
          showToast('🌐 翻译中...');
        });
      });

      // ====== View Skill File ======
      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'viewSkillFile', command: btn.getAttribute('data-cmd') });
          showToast('📄 打开中...');
        });
      });

      // ====== Alias ======
      var currentAliasCmd = '';
      document.querySelectorAll('.alias-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          currentAliasCmd = btn.getAttribute('data-cmd');
          document.getElementById('aliasSkillName').textContent = '为 ' + currentAliasCmd + ' 设置别名';
          document.getElementById('aliasInput').value = '';
          document.getElementById('aliasModal').classList.add('show');
          setTimeout(function() { document.getElementById('aliasInput').focus(); }, 100);
        });
      });
      document.getElementById('cancelAlias').addEventListener('click', function() { document.getElementById('aliasModal').classList.remove('show'); });
      document.getElementById('confirmAlias').addEventListener('click', function() {
        vscode.postMessage({ type: 'setAlias', command: currentAliasCmd, alias: document.getElementById('aliasInput').value.trim() });
        document.getElementById('aliasModal').classList.remove('show');
        showToast('✅ 别名已更新');
      });
      document.getElementById('clearAlias').addEventListener('click', function() {
        vscode.postMessage({ type: 'setAlias', command: currentAliasCmd, alias: '' });
        document.getElementById('aliasModal').classList.remove('show');
        showToast('✅ 别名已清除');
      });

      // ====== Tag ======
      document.querySelectorAll('.tag-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          vscode.postMessage({ type: 'setSkillTag', command: btn.getAttribute('data-cmd') });
        });
      });

      // ====== Remove ======
      var currentRemoveCmd = '';
      document.querySelectorAll('.remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          currentRemoveCmd = btn.getAttribute('data-cmd');
          document.getElementById('removeSkillName').textContent = '确定移除 ' + currentRemoveCmd + ' 吗？';
          document.getElementById('removeModal').classList.add('show');
        });
      });
      document.getElementById('cancelRemove').addEventListener('click', function() { document.getElementById('removeModal').classList.remove('show'); });
      document.getElementById('confirmRemove').addEventListener('click', function() {
        vscode.postMessage({ type: 'removeSkill', command: currentRemoveCmd });
        document.getElementById('removeModal').classList.remove('show');
        showToast('🗑️ 移除中...');
      });

      // ====== AI Classify ======
      document.getElementById('classifyBtn').addEventListener('click', function() {
        showToast('🧠 AI 分析中，请稍候...');
        vscode.postMessage({ type: 'classifySkills' });
      });

      // ====== Refresh ======
      document.getElementById('refreshBtn').addEventListener('click', function() {
        showToast('🔄 刷新中...');
        vscode.postMessage({ type: 'refreshSkills' });
      });

      // ====== Import ======
      var importModal = document.getElementById('importModal');
      var importUrl = document.getElementById('importUrl');
      document.getElementById('importBtn').addEventListener('click', function() {
        importUrl.value = ''; importModal.classList.add('show');
        setTimeout(function() { importUrl.focus(); }, 100);
      });
      document.getElementById('cancelImport').addEventListener('click', function() { importModal.classList.remove('show'); });
      document.getElementById('confirmImport').addEventListener('click', function() {
        var url = importUrl.value.trim();
        if (!url || (!url.startsWith('http') && !url.startsWith('git@'))) { showToast('URL 不正确', true); return; }
        importModal.classList.remove('show');
        showToast('📥 导入中...');
        vscode.postMessage({ type: 'importSkill', url: url });
      });
      importModal.addEventListener('click', function(e) { if (e.target === importModal) importModal.classList.remove('show'); });
      importUrl.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('confirmImport').click(); if (e.key === 'Escape') importModal.classList.remove('show'); });

      // ====== Receive Messages ======
      window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
          case 'updateSkills':
            showToast('✅ 已更新 (' + msg.count + ' 个)');
            setTimeout(function() { vscode.postMessage({ type: 'reloadWebview' }); }, 800);
            break;
          case 'importResult':
            showToast(msg.message, !msg.success);
            if (msg.success) setTimeout(function() { vscode.postMessage({ type: 'refreshSkills' }); }, 500);
            break;
        }
      });
    })();
</script>
</body>
</html>`;
}
