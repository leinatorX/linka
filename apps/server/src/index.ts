import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";
import { initializeCategories } from "./services/categories.js";

import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const app = Fastify({
  logger: true
});

initializeCategories();

await app.register(cors, {
  origin: true
});

// 注册 Swagger OpenAPI 规范生成器
await app.register(swagger, {
  openapi: {
    info: {
      title: "Linka API 文档",
      description: "Linka 书签管理与 AI 助手后端接口文档",
      version: "0.1.0"
    },
    servers: [
      {
        url: `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${config.port}`,
        description: "本地服务"
      }
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "请输入 'Bearer <apiToken>'（若配置了 API_TOKEN）"
        }
      }
    }
  }
});

// 注册 Swagger UI 静态页面托管，公开端点为 /documentation
await app.register(swaggerUi, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

await registerRoutes(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const indexHtml = path.join(publicDir, "index.html");

if (fs.existsSync(indexHtml)) {
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/"
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ message: "接口不存在" });
    }

    return reply.type("text/html").send(fs.createReadStream(indexHtml));
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
