import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif|heic|heif)$/i;

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type ?? "";

  if (ext === "pdf" || mime === "application/pdf") {
    return extractPdfText(file);
  }

  if (ext === "docx" || mime.includes("officedocument.wordprocessingml")) {
    return extractDocxText(file);
  }

  if (ext === "txt" || mime.startsWith("text/")) {
    return await file.text();
  }

  if (IMAGE_RE.test(file.name) || mime.startsWith("image/")) {
    return extractImageText(file);
  }

  return `[Uploaded file: ${file.name} — text extraction not supported for this format]`;
}

/* ─────────────────────────────────────────────────────────────
   PDF extraction with italics → "quotes" and paragraph detection
   ───────────────────────────────────────────────────────────── */

// Curly/typographic quote marks that may appear in PDFs.
const OPEN_QUOTES = ["\u201C", "\u201F", "\u201E", "\u00AB", "\u2018", "\u201B"];
const CLOSE_QUOTES = ["\u201D", "\u00BB", "\u2019"];
const ALL_QUOTES = new Set([...OPEN_QUOTES, ...CLOSE_QUOTES, '"']);

function isItalicFont(fontName: string | undefined): boolean {
  if (!fontName) return false;
  return /italic|oblique|-it\b|_it\b/i.test(fontName);
}

/** Replace stray single quote marks (excluding apostrophes inside words) and curly quotes with straight `"`. */
function normalizeQuotes(text: string): string {
  // Convert curly double quotes → straight
  let s = text.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"');

  // Convert curly single quotes used as QUOTATION marks (not apostrophes) → straight double.
  // An apostrophe sits between two letters (it's, Florine's, won't). A quote mark sits at
  // a word boundary (space, start, end, punctuation on one side).
  s = s.replace(/[\u2018\u2019\u201B]/g, (match, offset, full) => {
    const prev = full[offset - 1] ?? "";
    const next = full[offset + 1] ?? "";
    const prevIsLetter = /\p{L}/u.test(prev);
    const nextIsLetter = /\p{L}/u.test(next);
    if (prevIsLetter && nextIsLetter) return "'"; // apostrophe in contraction
    if (prevIsLetter && /[a-z]/i.test(prev) && /\s|[.,;:!?)\]]|$/.test(next)) {
      // Trailing apostrophe like "Florine'" — likely possessive, keep as apostrophe.
      return "'";
    }
    return '"';
  });

  return s;
}

/** Ensure every `"` has a pair: if odd count, infer missing close at next strong punct or paragraph end. */
function balanceQuotes(paragraph: string): string {
  const count = (paragraph.match(/"/g) ?? []).length;
  if (count % 2 === 0) return paragraph;

  // Odd → one unmatched. Find last `"` and try to close it before the next strong punctuation,
  // otherwise append a closing quote at paragraph end.
  const lastIdx = paragraph.lastIndexOf('"');
  // Look forward for the first sentence-ending punctuation after lastIdx.
  const after = paragraph.slice(lastIdx + 1);
  const m = after.match(/[.;!?](?=\s|$)/);
  if (m && m.index !== undefined) {
    const insertAt = lastIdx + 1 + m.index + 1;
    return paragraph.slice(0, insertAt) + '"' + paragraph.slice(insertAt);
  }
  return paragraph + '"';
}

/** Join hyphenated line breaks: "pic-\nture" → "picture". Collapse internal whitespace. */
function cleanupWhitespace(text: string): string {
  return text
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2") // de-hyphenate across lines
    .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
    .replace(/ ?\n ?/g, "\n") // trim spaces around newlines
    .replace(/\n{3,}/g, "\n\n") // max one blank line
    .trim();
}

interface PdfItem {
  str: string;
  fontName?: string;
  transform: number[]; // [a, b, c, d, e, f] — f is Y
  width: number;
  height: number;
  hasEOL?: boolean;
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as unknown as PdfItem[];
    pages.push(renderPage(items, i));
  }

  return pages.join("\n\n");
}

function renderPage(items: PdfItem[], pageNum: number): string {
  if (items.length === 0) return `--- Page ${pageNum} ---\n`;

  // Median line height — used to decide paragraph breaks.
  const heights = items.map((it) => it.height).filter((h) => h > 0).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;

  let out = "";
  let prevY: number | null = null;
  let prevWasItalic = false;
  let inQuote = false; // currently emitting an italic-induced quoted span

  const flushItalicClose = () => {
    if (inQuote) {
      out += '"';
      inQuote = false;
    }
  };

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const rawStr = it.str ?? "";
    if (!rawStr && !it.hasEOL) continue;

    const y = it.transform?.[5] ?? 0;
    const italic = isItalicFont(it.fontName) && rawStr.trim().length > 0;

    // Decide spacing relative to previous item.
    if (prevY !== null) {
      const dy = prevY - y; // PDF Y grows upward; positive dy = moved down
      if (dy > medianH * 1.6) {
        // New paragraph
        flushItalicClose();
        out = out.replace(/\s+$/, "") + "\n\n";
      } else if (dy > medianH * 0.4) {
        // New line, same paragraph — ensure single space
        if (!/\s$/.test(out) && out.length > 0) out += " ";
      } else {
        // Same line — ensure a single separating space if needed
        if (out.length > 0 && !/\s$/.test(out) && !/^[\s.,;:!?)\]]/.test(rawStr)) {
          out += " ";
        }
      }
    }

    // Open italic-quote on transition non-italic → italic
    if (italic && !prevWasItalic) {
      // Don't double-open if the text already starts with a quote
      const trimmed = rawStr.replace(/^\s+/, "");
      const startsWithQuote = trimmed.length > 0 && ALL_QUOTES.has(trimmed[0]);
      if (!startsWithQuote) {
        out += '"';
        inQuote = true;
      }
    }

    // Close italic-quote on transition italic → non-italic
    if (!italic && prevWasItalic) {
      if (inQuote) {
        // Trim trailing space we just emitted before closing
        out = out.replace(/\s+$/, "");
        out += '"';
        inQuote = false;
        // Restore a space before the next content
        if (rawStr.length > 0 && !/^\s/.test(rawStr)) out += " ";
      }
    }

    out += rawStr;
    prevWasItalic = italic;
    prevY = y;
  }

  flushItalicClose();

  // Post-process: quote normalization, hyphen join, whitespace cleanup, balance per paragraph.
  let cleaned = normalizeQuotes(out);
  cleaned = cleanupWhitespace(cleaned);
  cleaned = cleaned
    .split(/\n\n+/)
    .map((p) => balanceQuotes(p.trim()))
    .filter((p) => p.length > 0)
    .join("\n\n");

  return `--- Page ${pageNum} ---\n\n${cleaned}`;
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Lazy-load Tesseract.js (~2MB worker) only when an image is processed.
async function extractImageText(file: File): Promise<string> {
  try {
    const { recognize } = await import("tesseract.js");
    const { data } = await recognize(file, "eng");
    const text = (data?.text ?? "").trim();
    if (!text) {
      return `[Image attached: ${file.name} — no readable text detected via OCR]`;
    }
    return text;
  } catch (err) {
    console.warn("OCR failed:", err);
    return `[Image attached: ${file.name} — OCR unavailable]`;
  }
}
