import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app";
import { validateRuntime } from "./runtime";
import { configureBody } from "./body";
async function main() {
  validateRuntime();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEV_ADAPTERS === "true"
  )
    throw new Error("Development adapters are prohibited in production");
  // rawBody: payment webhooks are signed over the exact bytes received.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureBody(app);
  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || "127.0.0.1",
  );
}
void main();
