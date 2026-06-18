/**
 * Standalone CLI translation script
 * Called as a child process from the VS Code extension host.
 * This bypasses any network restrictions in the extension host.
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
  // Args: command label description
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("用法: translate-cli <command> <label> <description>");
    process.exit(1);
  }

  const command = args[0];
  const label = args[1];
  const description = args.slice(2).join(" ");

  const config = getApiConfig();
  if (!config.apiKey) {
    console.error("ERROR: 未找到 API Key");
    process.exit(1);
  }

  const prompt = `Translate the following English description to concise Chinese (zh-CN).
Return ONLY valid JSON with field "descCn" - the Chinese translation.
Keep technical terms (like API, CLI, TDD, Git, etc.) in English.
Be concise. If the text is long, summarize its key meaning.

Description: ${description}

JSON:`;

  const body = JSON.stringify({
    model: config.model,
    max_tokens: 2000,
    system: "You are a translator. Translate the text to Chinese. Return ONLY valid JSON. Keep output very short and concise.",
    messages: [{ role: "user", content: prompt }],
  });

  const url = new URL(config.baseUrl + "/v1/messages");

  const rawData = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
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
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT"));
    });
    req.write(body);
    req.end();
  });

  const data = JSON.parse(rawData);

  // Try different response formats
  let text = "";

  // Anthropic format: content is array of blocks, find the text block
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find((b: any) => b.type === "text");
    if (textBlock?.text) text = textBlock.text;
  }

  // OpenAI-compatible format
  if (!text && data.choices?.[0]?.message?.content) {
    // OpenAI-compatible format
    text = data.choices[0].message.content;
  } else if (data.response) {
    text = data.response;
  }

  if (!text) {
    const blockInfo = (data.content || []).map((b: any, i: number) => `[${i}] type=${b.type} hasText=${!!b.text} keys=${Object.keys(b).join(",")}`).join("; ");
    console.error("ERROR: 无法找到翻译内容。Content结构: " + blockInfo + " | 完整返回: " + JSON.stringify(data).slice(0, 800));
    process.exit(1);
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("ERROR: 返回格式异常: " + text.slice(0, 100));
    process.exit(1);
  }

  const result = JSON.parse(jsonMatch[0]);
  const descCn = result.descCn || result.labelCn || result.translation || description;
  const output = JSON.stringify({ descCn });

  console.log(output);
}

main().catch((err) => {
  console.error("ERROR: " + (err.message || err));
  process.exit(1);
});
