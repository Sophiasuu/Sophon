import { lstat } from "node:fs/promises";
import path from "node:path";

// ── Structured logging ──────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel: LogLevel = "warn";

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

export function log(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[currentLogLevel]) return;

  const entry = {
    level,
    module,
    message,
    ...(context ? { context } : {}),
  };

  switch (level) {
    case "error":
      console.error(`[${module}] ${message}`, context ? JSON.stringify(context) : "");
      break;
    case "warn":
      console.warn(`[${module}] ${message}`, context ? JSON.stringify(context) : "");
      break;
    case "debug":
      if (process.env.SOPHON_DEBUG) {
        console.debug(`[${module}] ${message}`, context ? JSON.stringify(context) : "");
      }
      break;
    default:
      // info — only log in verbose mode to avoid cluttering normal output
      if (process.env.SOPHON_VERBOSE) {
        console.log(JSON.stringify(entry));
      }
      break;
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function stableHash(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * JSON.stringify that also escapes <, >, &, and ' as Unicode escapes.
 * Prevents </script> injection when JSON values appear inside HTML <script> tags
 * and prevents attribute breakout when values are used in HTML attributes.
 */
export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027");
}

/**
 * Escape a string for safe use inside XML elements.
 * Handles &, <, >, ", and ' — the five XML special characters.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Sanitize a CSV cell value to prevent formula injection.
 * Prefixes cells starting with =, +, -, @, \t, or \r with a single quote.
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function assertSafePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`Output path must be within the project directory: ${filePath}`);
  }
}

/**
 * Like assertSafePath but also detects symlinks that could escape the project directory.
 * Use this for write operations where symlink escapes are a concern.
 */
export async function assertSafePathStrict(filePath: string): Promise<void> {
  assertSafePath(filePath);

  // Check each existing ancestor for symlinks
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();
  let current = resolved;

  while (current !== cwd && current !== path.dirname(current)) {
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`Symbolic link detected in output path: ${current}`);
      }
    } catch (error) {
      // If file doesn't exist yet, that's fine — walk up to parent
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        current = path.dirname(current);
        continue;
      }
      // Re-throw symlink errors
      if (error instanceof Error && error.message.includes("Symbolic link")) {
        throw error;
      }
      break;
    }
    current = path.dirname(current);
  }
}
