import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export const REQUEST_TIMEOUT_MS = 45_000;
export const USAGE_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_URLS_PER_EXTRACT = 20;
export const MAX_DOMAINS = 20;
export const KEY_FILE_PATH = join(homedir(), ".pi", "agent", "tavily.key");
export const TAVILY_DASHBOARD_URL = "https://app.tavily.com/home";
export const TAVILY_DOCS_URL = "https://docs.tavily.com/documentation/api-reference/endpoint/usage";
export const TEMP_DIR_PREFIX = join(tmpdir(), "pi-tavily-");
