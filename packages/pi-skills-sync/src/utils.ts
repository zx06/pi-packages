// Shared utilities for pi-skills-sync

import { resolve } from "path";
import { homedir } from "os";

/** Expand ~/ prefix to absolute path */
export function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }
  return resolve(path);
}

/** Check if an error is a file-not-found error */
export function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    ("code" in error ? (error as NodeJS.ErrnoException).code === "ENOENT" : error.message.includes("ENOENT"))
  );
}
