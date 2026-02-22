/**
 * Core structured logger
 */
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import config from "../config";

const LOG_DIR = config.LOG_DIR;
const level = config.LOG_LEVEL;
const serviceName = process.env.SERVICE_NAME || "dex-aggregator-api";
const envName = config.NODE_ENV;
const maxFiles = process.env.LOG_MAX_FILES || "14d";
const consoleEnabled =
  (process.env.LOG_CONSOLE || "true").toLowerCase() === "true";

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const transports: winston.transport[] = [];

transports.push(
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: "app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles,
    zippedArchive: false,
    level,
  }) as any,
);

transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
    level,
  }),
);

// Optionally remove console transport when LOG_CONSOLE is false
if (!consoleEnabled) {
  // filter out Console transports
  for (let i = transports.length - 1; i >= 0; i--) {
    if (transports[i] instanceof winston.transports.Console)
      transports.splice(i, 1);
  }
}

const logger = winston.createLogger({
  level,
  format: jsonFormat,
  defaultMeta: { service: serviceName, env: envName },
  transports,
});

export default logger;
