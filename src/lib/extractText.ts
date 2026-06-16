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

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n\n");
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
