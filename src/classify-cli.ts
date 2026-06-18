/**
 * Standalone CLI script for AI-powered skill classification
 * Called as a child process from the extension host.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "C:\\Users\\Administrator";

function getApiConfig(): { apiKey: string; baseUrl: string; model: string } {
  try {
    const settingsPath = path.join(HOME_DIR, ".claude", "settings.json");
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      const env = settings.env || {};
      return {
        apiKey: env.ANTHROPIC_API_KEY || "",
        baseUrl: (env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, ""),
        model: env.ANTHROPIC_MODEL || "deepseek-v4-flash",
      };
    }
  } catch {}
  return { apiKey: "", baseUrl: "https://api.anthropic.com", model: "deepseek-v4-flash" };
}

async function main() {
  // Read skills data from stdin (avoids Windows command line length limits)
  const stdin = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });

  if (!stdin.trim()) {
    console.error("用法: 通过 stdin 传入 JSON 数据");
    process.exit(1);
  }

  const skillsData = JSON.parse(stdin);
  const config = getApiConfig();
  if (!config.apiKey) {
    console.error("ERROR: 未找到 API Key");
    process.exit(1);
  }

  // Build a prompt that asks AI to classify all skills
  const skillList = skillsData.map((s: any, i: number) =>
    `${i + 1}. Command: ${s.command}\n   Name: ${s.label}\n   Description: ${s.description}`
  ).join("\n\n");

  const categories = [
    "代码审查与质量", "测试与调试", "架构与设计", "前端开发", "后端开发",
    "DevOps与部署", "数据库", "项目管理", "文档与写作", "研究与分析",
    "安全审查", "AI与机器学习", "工具与效率", "UI/UX设计", "其他"
  ];

  const prompt = `Classify each software development skill into ONE of these categories:
${categories.join(", ")}

For each skill, return ONLY a JSON array where each element is {"command":"...","category":"..."}.
Base the category on the skill's name and description. Be specific and consistent.

Skills to classify:
${skillList}

JSON array:`;

  const body = JSON.stringify({
    model: config.model,
    max_tokens: 4000,
    system: "You are a skill classifier. Return ONLY valid JSON. Be concise. No explanation.",
    messages: [{ role: "user", content: prompt }],
  });

  const url = new URL(config.baseUrl + "/v1/messages");

  const rawData = await new Promise<string>((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : 443,
      path: url.pathname,
      method: "POST",
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => data += chunk.toString());
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else resolve(data);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.write(body);
    req.end();
  });

  const data = JSON.parse(rawData);
  let text = "";

  // Find text block in response
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find((b: any) => b.type === "text");
    if (textBlock?.text) text = textBlock.text;
  }
  if (!text && data.choices?.[0]?.message?.content) text = data.choices[0].message.content;

  // Parse JSON from response
  // Try to find JSON array or object in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // Try object format
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      console.log(objMatch[0]);
      process.exit(0);
    }
    console.error("ERROR: 返回内容: " + text.slice(0, 300));
    process.exit(1);
  }

  const result = JSON.parse(jsonMatch[0]);
  const output: Record<string, string> = {};
  for (const item of result) {
    if (item.command && item.category) {
      output[item.command] = item.category;
    }
  }

  console.log(JSON.stringify(output));
}

main().catch((err) => {
  console.error("ERROR: " + (err.message || err));
  process.exit(1);
});
