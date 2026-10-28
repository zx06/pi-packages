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

/** Human-readable relative time for sync timestamps. */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
