import path from "node:path";

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  appUrl: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  apiToken: string;
}

export const config: AppConfig = {
  port: Number(process.env.LINKA_PORT ?? 3030),
  host: process.env.LINKA_HOST ?? "0.0.0.0",
  dbPath: path.resolve(process.env.LINKA_DB_PATH ?? "./data/linka.sqlite"),
  appUrl: process.env.LINKA_APP_URL ?? "http://localhost:3030",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  apiToken: process.env.LINKA_API_TOKEN ?? ""
};
