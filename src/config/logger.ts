import pino from "pino";
import type { Env } from "./env.js";

export function buildLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: { colorize: true }
          }
        : undefined
  });
}
