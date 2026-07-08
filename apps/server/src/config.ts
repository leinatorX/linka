import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  appUrl: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  apiToken: string;
  defaultUsername: string;
  defaultPassword: string;
  enableDocs: boolean;
}

function findWorkspaceRoot(startDir: string) {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { name?: string; workspaces?: unknown };

      if (packageJson.name === "linka" && Array.isArray(packageJson.workspaces)) {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return process.cwd();
    }

    currentDir = parentDir;
  }
}

function resolveDbPath() {
  if (process.env.LINKA_DB_PATH) {
    return path.resolve(process.env.LINKA_DB_PATH);
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(findWorkspaceRoot(moduleDir), "data", "linka.sqlite");
}

function resolveEnableDocs() {
  const raw = process.env.LINKA_ENABLE_DOCS;
  if (typeof raw === "string") {
    return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
  }

  return process.env.NODE_ENV !== "production";
}

export const config: AppConfig = {
  port: Number(process.env.LINKA_PORT ?? 3030),
  host: process.env.LINKA_HOST ?? "0.0.0.0",
  dbPath: resolveDbPath(),
  appUrl: process.env.LINKA_APP_URL ?? "http://localhost:3030",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  apiToken: process.env.LINKA_API_TOKEN ?? "",
  defaultUsername: process.env.LINKA_DEFAULT_USERNAME ?? "admin",
  defaultPassword: process.env.LINKA_DEFAULT_PASSWORD ?? "linka123456",
  enableDocs: resolveEnableDocs()
};
