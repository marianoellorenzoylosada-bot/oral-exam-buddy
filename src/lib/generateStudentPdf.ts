import jsPDF from "jspdf";
import type { PartFeedback } from "@/lib/partFeedback";
import { getPartsForLevel } from "@/lib/partFeedback";
import { toTextList } from "@/lib/toText";
import { toSecondPerson } from "@/lib/secondPerson";

interface CriterionData {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface StudentReportData {
  title: string;
  candidateName: string;
  levelCode: string;
  language: string;
  overallBand: string;
  overallScore: number;
  criteria: CriterionData[];
  strengths: string[];
  areasForImprovement: string[];
  date: string;
  /** Optional links to suggested practice activities. */
  practice?: { title: string; url: string }[];
  /** Per-part × per-criterion feedback (optional). */
  partFeedback?: PartFeedback[];
  /** Short synthesis paragraph. */
  overallSummary?: string;
  /** "save" downloads the file (default); "print" opens the print dialog; "blob" returns a Blob for sharing. */
  output?: "save" | "print" | "blob";
}

export type { StudentReportData };

const BRAND: [number, number, number] = [30, 64, 175];
const MUTED: [number, number, number] = [100, 116, 139];
const SUCCESS: [number, number, number] = [5, 150, 105];
const WARNING: [number, number, number] = [217, 119, 6];

const NO_EVIDENCE = /^\s*(no evidence|not covered|n\/?a|insufficient)\b/i;
const useful = (t?: string) => !!(t && t.trim().length > 2 && !NO_EVIDENCE.test(t));

interface PartBlock {
  heading: string;
  body: string;
  next?: string;
}

/** Layout knobs, tried from most generous to tightest. */
interface FitConfig {
  bodySize: number;
  lh: number;
  gap: number;
  listItems: number;
  links: number;
  showNext: boolean;
  /** Last-resort content trimming (99 = keep everything). */
  partLines: number;
  itemLines: number;
}

const CONFIGS: FitConfig[] = [
  { bodySize: 9.6, lh: 4.6, gap: 4.0, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 9.2, lh: 4.4, gap: 3.6, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 8.8, lh: 4.2, gap: 3.2, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 8.4, lh: 4.0, gap: 2.8, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 8.0, lh: 3.8, gap: 2.4, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 7.7, lh: 3.6, gap: 2.1, listItems: 3, links: 3, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 7.4, lh: 3.4, gap: 1.9, listItems: 3, links: 2, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 7.1, lh: 3.2, gap: 1.7, listItems: 3, links: 2, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 6.9, lh: 3.1, gap: 1.5, listItems: 2, links: 2, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 6.8, lh: 3.0, gap: 1.3, listItems: 2, links: 0, showNext: true, partLines: 99, itemLines: 99 },
  { bodySize: 6.7, lh: 2.95, gap: 1.2, listItems: 2, links: 0, showNext: false, partLines: 99, itemLines: 99 },
  { bodySize: 6.7, lh: 2.95, gap: 1.2, listItems: 2, links: 0, showNext: false, partLines: 8, itemLines: 3 },
  { bodySize: 6.7, lh: 2.95, gap: 1.2, listItems: 2, links: 0, showNext: false, partLines: 5, itemLines: 2 },
];

/**
 * Student-facing feedback on a single A4 page.
 * Learning-oriented: organised by exam part, addressed to the student, concrete
 * next steps, no transcript and no per-criterion breakdown inside each part.
 *
 * Fitting strategy: the page is rendered on a scratch document for each layout
 * config (largest type first) and the first one that fits is used, so type is
 * only shrunk when needed and content is trimmed only as a last resort.
 */
export function generateStudentPdf(input: StudentReportData): Blob | void {
  const you = (t: string) => toSecondPerson(t, input.candidateName);
  const strengths = toTextList(input.strengths).filter(useful).map(you);
  const improvements = toTextList(input.areasForImprovement).filter(useful).map(you);

  const levelParts = getPartsForLevel(input.levelCode);
  const byLabel = new Map(
    (input.partFeedback ?? [])
      .filter((p) => !!p && typeof p.part === "string")
      .map((p) => [p.part.trim().toLowerCase(), p])
  );

  const partBlocks: PartBlock[] = [];
  for (const { part, title } of levelParts) {
    const pf = byLabel.get(part.toLowerCase());
    if (!pf) continue;
    const pieces: string[] = [];
    if (useful(pf.commentary)) pieces.push(you(pf.commentary!.trim()));
    for (const c of (pf.criteriaBreakdown ?? []).filter((c) => useful(c?.comment))) {
      pieces.push(you(c.comment.trim()));
    }
    const body = pieces.join(" ");
    if (!body && !useful(pf.improvement)) continue;
    partBlocks.push({
      heading: [part, pf.title || title].filter(Boolean).join(" — "),
      body,
      next: useful(pf.improvement) ? you(pf.improvement!.trim()) : undefined,
    });
  }

  const makeDoc = () => new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const probe = makeDoc();
  const pageW = probe.internal.pageSize.getWidth();
  const pageH = probe.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - 16; // room for the footer

  /** Trim text to at most `maxLines` lines (only used by the tightest configs). */
  const clamp = (doc: jsPDF, text: string, size: number, width: number, maxLines: number) => {
    if (maxLines >= 99) return text;
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    const lines: string[] = doc.splitTextToSize(text, width);
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join(" ").replace(/[\s,;:.]+$/, "") + "…";
  };

  /** Draw the whole page with a given config; returns the final y position. */
  const render = (doc: jsPDF, cfg: FitConfig): number => {
    const parts = partBlocks.map((p) => ({
      heading: p.heading,
      body: p.body ? clamp(doc, p.body, cfg.bodySize, contentW - 3, cfg.partLines) : "",
      next: cfg.showNext && p.next ? clamp(doc, p.next, cfg.bodySize - 0.4, contentW - 10, cfg.partLines) : undefined,
    }));
    const sList = strengths.slice(0, cfg.listItems).map((t) => clamp(doc, t, cfg.bodySize, contentW - 6, cfg.itemLines));
    const iList = improvements
      .slice(0, cfg.listItems)
      .map((t) => clamp(doc, t, cfg.bodySize, contentW - 6, cfg.itemLines));
    const links = (input.practice ?? []).slice(0, cfg.links);

    // ── Header ───────────────────────────────────────────────────
    const chipW = 46;
    const chipX = pageW - margin - chipW;
    const chipCx = chipX + chipW / 2;
    const bandCaption = (input.overallBand || "").trim();
    doc.setFontSize(7.4);
    doc.setFont("helvetica", "normal");
    const capLines: string[] = bandCaption ? doc.splitTextToSize(bandCaption, chipW - 5) : [];
    const chipH = 10 + capLines.length * 3.3 + 4.5;
    const headerH = Math.max(30, chipH + 8);

    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    const name = (input.candidateName || "").trim();
    const headTitle = name ? `${name} — Speaking Feedback` : "Speaking Feedback";
    doc.text(doc.splitTextToSize(headTitle, pageW - margin * 2 - chipW - 6)[0], margin, 11);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${input.levelCode} · ${input.language} · ${input.date}`, margin, 17.5);
    doc.setFontSize(8);
    doc.text("Here is what you did in your speaking exam, and what to work on next.", margin, 23.5, {
      maxWidth: pageW - margin * 2 - chipW - 6,
    });

    // Band chip: level code big, full band sentence below it (no repetition).
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chipX, 4, chipW, chipH, 2, 2, "F");
    doc.setTextColor(...BRAND);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(input.levelCode || "—", chipCx, 11.5, { align: "center" });
    doc.setFontSize(7.4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    let capY = 15.6;
    for (const line of capLines) {
      doc.text(line, chipCx, capY, { align: "center" });
      capY += 3.3;
    }
    doc.setTextColor(...BRAND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.text(`${input.overallScore.toFixed(1)} / 5.0`, chipCx, capY + 1.2, { align: "center" });

    let y = headerH + 5;

    // ── Marks strip (full criterion names) ───────────────────────
    if (input.criteria.length > 0) {
      const cellW = contentW / input.criteria.length;
      const nameSize = input.criteria.length >= 5 ? 6.3 : 7;
      doc.setFontSize(nameSize);
      doc.setFont("helvetica", "normal");
      const nameLines = input.criteria.map((c) => doc.splitTextToSize(c.name, cellW - 2.5) as string[]);
      const maxNameLines = nameLines.reduce((m, l) => Math.max(m, l.length), 1);
      const stripH = 4 + maxNameLines * 2.9 + 6;
      doc.setDrawColor(225, 232, 240);
      doc.setFillColor(246, 249, 255);
      doc.roundedRect(margin, y, contentW, stripH, 2, 2, "FD");
      input.criteria.forEach((c, i) => {
        const cx = margin + cellW * i + cellW / 2;
        doc.setFontSize(nameSize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        let ny = y + 3.8;
        for (const line of nameLines[i]) {
          doc.text(line, cx, ny, { align: "center" });
          ny += 2.9;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND);
        doc.text(`${c.score}/${c.maxScore}`, cx, y + stripH - 2, { align: "center" });
      });
      y += stripH + 4;
    }

    // ── Feedback by part ─────────────────────────────────────────
    if (parts.length > 0) {
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Your feedback, part by part", margin, y);
      y += 5.8;

      for (const p of parts) {
        doc.setFontSize(9.2);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND);
        doc.text(p.heading, margin, y);
        y += 4.8;

        if (p.body) {
          doc.setFontSize(cfg.bodySize);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(20, 20, 20);
          doc.splitTextToSize(p.body, contentW - 3).forEach((line: string) => {
            doc.text(line, margin + 3, y);
            y += cfg.lh;
          });
        }

        if (p.next) {
          doc.setFontSize(cfg.bodySize - 0.4);
          doc.setFont("helvetica", "bolditalic");
          doc.setTextColor(...WARNING);
          doc.splitTextToSize(`Try this next: ${p.next}`, contentW - 10).forEach((line: string) => {
            doc.text(line, margin + 3, y);
            y += cfg.lh;
          });
          y += 1;
        }
        y += cfg.gap;
      }
    }

    // ── Strengths / next steps: one full-width column each ────────
    const drawList = (title: string, color: [number, number, number], items: string[]) => {
      if (items.length === 0) return;
      doc.setFontSize(9.6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(title, margin, y);
      y += 5.6;
      doc.setFontSize(cfg.bodySize);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      for (const t of items) {
        doc.splitTextToSize(t, contentW - 10).forEach((line: string, i: number) => {
          if (i === 0) doc.text("•", margin + 2, y);
          doc.text(line, margin + 6, y);
          y += cfg.lh;
        });

      }
      y += cfg.gap;
    };
    drawList("What you did well", SUCCESS, sList);
    drawList("What to practise next", WARNING, iList);

    // ── Practice links: one line each, "Title: url" ───────────────
    if (links.length > 0) {
      doc.setFontSize(9.6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND);
      doc.text("Keep improving with these", margin, y);
      y += 5.6;
      for (const p of links) {
        const label = `•  ${p.title}: `;
        doc.setFontSize(cfg.bodySize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20, 20, 20);
        doc.text(label, margin + 2, y);
        const labelW = doc.getTextWidth(label);
        const avail = contentW - 4 - labelW;
        doc.setTextColor(...BRAND);
        let url = p.url;
        let size = cfg.bodySize;
        while (size > 5.6 && doc.getTextWidth(url) > avail) {
          size -= 0.3;
          doc.setFontSize(size);
        }
        if (doc.getTextWidth(url) > avail) {
          const clean = url.replace(/^https?:\/\//, "");
          url = clean.length > 46 ? `${clean.slice(0, 30)}…${clean.slice(-12)}` : clean;
        }
        doc.textWithLink(url, margin + 2 + labelW, y, { url: p.url });
        y += cfg.lh + 0.8;
      }
    }

    // ── Footer ───────────────────────────────────────────────────
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(
      "© 2026 OralAssess AI · Student feedback summary · Discuss with your teacher for full details.",
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );

    return y;
  };

  // Pick the most generous layout that still fits on one page.
  let chosen = CONFIGS[CONFIGS.length - 1];
  for (const cfg of CONFIGS) {
    const scratch = makeDoc();
    if (render(scratch, cfg) <= bottomLimit) {
      chosen = cfg;
      break;
    }
  }

  const doc = makeDoc();
  render(doc, chosen);

  const safeName = (input.candidateName || "student").replace(/\s+/g, "_");
  const filename = `Student_Feedback_${safeName}_${input.date.replace(/\//g, "-")}.pdf`;
  if (input.output === "blob") {
    return doc.output("blob") as Blob;
  }
  if (input.output === "print") {
    doc.autoPrint();
    const url = doc.output("bloburl") as unknown as string;
    window.open(url, "_blank");
    return;
  }
  doc.save(filename);
}
