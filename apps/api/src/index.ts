import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(jwt, { secret: config.jwtSecret });

  app.decorate(
    "authenticate",
    async function (this: Fastify.FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );

  await registerRoutes(app);

  await app.listen({ port: config.port, host: config.host });
  console.log(`API listening on http://${config.host}:${config.port}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
