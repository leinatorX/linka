import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
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
