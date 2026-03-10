import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@mariozechner/pi-coding-agent";

const truncationNote = `Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; when truncated, the full output is saved to a temp file.`;

export const searchToolDescription = `Search the web with Tavily for current information, official docs, web pages, and news. ${truncationNote}`;

export const extractToolDescription = `Extract the main content of one or more web pages with Tavily. Useful for reading docs, blog posts, and announcements. ${truncationNote}`;

export const crawlToolDescription = `Crawl related pages from a starting URL with Tavily. Useful for exploring documentation sites, knowledge bases, and blog directories in bulk. ${truncationNote}`;
