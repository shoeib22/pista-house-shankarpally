import type { INestApplication } from "@nestjs/common";

/**
 * JSON bodies are small everywhere except support requests with photos (up to
 * three at 800 KB each, base64 encoded), so allow a few megabytes.
 */
export function configureBody(app: INestApplication) {
  (app as any).useBodyParser("json", { limit: "4mb" });
}
