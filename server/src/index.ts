import path from "node:path";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "chronolog.db");
const cookieSecure = process.env.COOKIE_SECURE === "true";
const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
const registrationOpen = process.env.REGISTRATION_OPEN !== "false";
const webDist = process.env.WEB_DIST;

const app = await buildApp({
  dbPath,
  cookieSecure,
  sessionTtlSeconds,
  registrationOpen,
  webDist,
});

await app.listen({ port, host: "0.0.0.0" });
app.log.info(`Chronolog listening on ${port}`);
