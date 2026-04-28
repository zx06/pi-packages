// File path encoding for GitHub Gist API compatibility
//
// GitHub Gist API rejects filenames containing "/" (returns 422 Validation Failed).
// We use percent-encoding to safely embed path separators:
//   "/" → "%2F"     "%" → "%25" (encodes % first to avoid ambiguity)
//
// This is reversible and collision-free for all valid POSIX filenames.

/** Encode a relative file path for safe use as a Gist filename */
export function encodePath(path: string): string {
  return path.replace(/%/g, "%25").replace(/\//g, "%2F");
}

/** Decode a Gist filename back to a relative file path */
export function decodePath(filename: string): string {
  return filename.replace(/%2F/g, "/").replace(/%25/g, "%");
}
