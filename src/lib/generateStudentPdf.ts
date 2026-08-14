import jsPDF from "jspdf";
import type { PartFeedback } from "@/lib/partFeedback";
import { getPartsForLevel } from "@/lib/partFeedback";
import { toTextList } from "@/lib/toText";

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

/** Short label for the marks strip: "Grammar and Vocabulary" → "Grammar & Voc." */
function shortName(name: string): string {
  return name
    .replace(/\band\b/gi, "&")
    .replace(/Management/i, "Mgmt")
    .replace(/Vocabulary/i, "Voc.")
    .replace(/Interactive Communication/i, "Interaction")
    .replace(/Pronunciation/i, "Pron.")
    .trim();
}

interface PartBlock {
  heading: string;
  /** Main feedback sentence(s). */
  body: string;
  /** Concrete next step. */
  next?: string;
}

/**
 * Student-facing feedback on a single A4 page.
 * Learning-oriented: organised by exam part, concrete evidence, what to do next.
 * No transcript, no per-criterion breakdown inside each part.
 * When content exceeds one page it is trimmed by priority
 * (parts > strengths/areas > practice links) instead of spilling to page 2.
 */
export function generateStudentPdf(input: StudentReportData): Blob | void {
  const strengths = toTextList(input.strengths).filter(useful);
  const improvements = toTextList(input.areasForImprovement).filter(useful);

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
    if (useful(pf.commentary)) pieces.push(pf.commentary!.trim());
    // Fold the per-criterion notes into one flowing sentence list (no headings).
    const cb = (pf.criteriaBreakdown ?? []).filter((c) => useful(c?.comment));
    for (const c of cb) pieces.push(c.comment.trim());
    const body = pieces.join(" ");
    if (!body && !useful(pf.improvement)) continue;
    partBlocks.push({
      heading: [part, pf.title || title].filter(Boolean).join(" — "),
      body,
      next: useful(pf.improvement) ? pf.improvement!.trim() : undefined,
    });
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - 14; // leave room for the footer

  /** Measure how tall a text block will be at a given size/width. */
  const measure = (text: string, size: number, width: number, lh: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    return doc.splitTextToSize(text, width).length * lh;
  };

  /** Trim a text to at most `maxLines` lines at the given width. */
  const clamp = (text: string, size: number, width: number, maxLines: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    const lines: string[] = doc.splitTextToSize(text, width);
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join(" ").replace(/[\s,;:.]+$/, "") + "…";
  };

  // ── Fitting pass ───────────────────────────────────────────────
  // Progressively tighter layouts; the first one that fits is used.
  const configs = [
    { partLines: 4, listItems: 3, itemLines: 2, links: 3, showNext: true },
    { partLines: 3, listItems: 3, itemLines: 2, links: 3, showNext: true },
    { partLines: 3, listItems: 3, itemLines: 1, links: 2, showNext: true },
    { partLines: 2, listItems: 2, itemLines: 1, links: 2, showNext: true },
    { partLines: 2, listItems: 2, itemLines: 1, links: 1, showNext: false },
    { partLines: 1, listItems: 2, itemLines: 1, links: 1, showNext: false },
  ];

  const halfW = (contentW - 6) / 2;
  const HEADER_H = 26;
  const MARKS_H = 12;

  const planFor = (cfg: typeof configs[number]) => {
    const parts = partBlocks.map((p) => ({
      heading: p.heading,
      body: p.body ? clamp(p.body, 8.5, contentW - 3, cfg.partLines) : "",
      next: cfg.showNext && p.next ? clamp(p.next, 8, contentW - 8, 1) : undefined,
    }));
    const s = strengths.slice(0, cfg.listItems).map((t) => clamp(t, 8, halfW - 5, cfg.itemLines));
    const i = improvements.slice(0, cfg.listItems).map((t) => clamp(t, 8, halfW - 5, cfg.itemLines));
    const links = (input.practice ?? []).slice(0, cfg.links);

    let h = HEADER_H + 6 + MARKS_H + 4;
    if (parts.length > 0) {
      h += 6; // section heading
      for (const p of parts) {
        h += 5.5; // part heading
        if (p.body) h += measure(p.body, 8.5, contentW - 3, 4);
        if (p.next) h += 5;
        h += 2;
      }
    }
    if (s.length > 0 || i.length > 0) {
      h += 6;
      const colH = (items: string[]) =>
        items.reduce((acc, t) => acc + measure(`•  ${t}`, 8, halfW - 5, 4), 0);
      h += Math.max(colH(s), colH(i)) + 2;
    }
    if (links.length > 0) {
      h += 6 + links.length * 8;
    }
    return { parts, s, i, links, height: h };
  };

  let plan = planFor(configs[0]);
  for (const cfg of configs) {
    plan = planFor(cfg);
    if (margin + plan.height <= bottomLimit) break;
  }

  // ── Drawing ────────────────────────────────────────────────────
  let y = margin;

  // Header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`${input.candidateName || "Your"} — Speaking Feedback`, margin, 11);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${input.levelCode} · ${input.language} · ${input.date}`, margin, 17.5);

  // Band chip on the right
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - margin - 34, 5, 34, 16, 2, 2, "F");
  doc.setTextColor(...BRAND);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(input.overallBand || "—", pageW - margin - 17, 12.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${input.overallScore.toFixed(1)} / 5.0`, pageW - margin - 17, 18, { align: "center" });

  y = HEADER_H + 6;

  // Compact marks strip
  if (input.criteria.length > 0) {
    doc.setDrawColor(225, 232, 240);
    doc.setFillColor(246, 249, 255);
    doc.roundedRect(margin, y, contentW, MARKS_H, 2, 2, "FD");
    const cellW = contentW / input.criteria.length;
    input.criteria.forEach((c, i) => {
      const cx = margin + cellW * i + cellW / 2;
      doc.setFontSize(6.8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(shortName(c.name), cx, y + 4.6, { align: "center", maxWidth: cellW - 2 });
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND);
      doc.text(`${c.score}/${c.maxScore}`, cx, y + 9.8, { align: "center" });
    });
    y += MARKS_H + 4;
  }

  // Feedback by part
  if (plan.parts.length > 0) {
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Your feedback, part by part", margin, y);
    y += 6;

    for (const p of plan.parts) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND);
      doc.text(p.heading, margin, y);
      y += 4.5;

      if (p.body) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20, 20, 20);
        doc.splitTextToSize(p.body, contentW - 3).forEach((line: string) => {
          doc.text(line, margin + 3, y);
          y += 4;
        });
      }

      if (p.next) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bolditalic");
        doc.setTextColor(...WARNING);
        doc.text(`Try this next: ${p.next}`, margin + 3, y + 0.5, { maxWidth: contentW - 8 });
        y += 5;
      }
      y += 2;
    }
  }

  // Strengths / Areas in two columns
  if (plan.s.length > 0 || plan.i.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    if (plan.s.length > 0) {
      doc.setTextColor(...SUCCESS);
      doc.text("What you did well", margin, y);
    }
    if (plan.i.length > 0) {
      doc.setTextColor(...WARNING);
      doc.text("What to practise next", margin + halfW + 6, y);
    }
    const listTop = y + 5;

    const drawCol = (items: string[], x: number) => {
      let cy = listTop;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      for (const t of items) {
        doc.splitTextToSize(`•  ${t}`, halfW - 5).forEach((line: string) => {
          doc.text(line, x, cy);
          cy += 4;
        });
      }
      return cy;
    };
    const leftEnd = drawCol(plan.s, margin + 2);
    const rightEnd = drawCol(plan.i, margin + halfW + 8);
    y = Math.max(leftEnd, rightEnd) + 2;
  }

  // Practice links
  if (plan.links.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND);
    doc.text("Keep improving with these", margin, y);
    y += 5;
    doc.setFontSize(8);
    for (const p of plan.links) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      doc.text(`•  ${p.title}`, margin + 2, y);
      y += 3.8;
      doc.setTextColor(...BRAND);
      doc.textWithLink(`   ${p.url}`, margin + 2, y, { url: p.url });
      y += 4.2;
    }
  }

  // Footer
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(
    "© 2026 OralAssess AI · Student feedback summary · Discuss with your teacher for full details.",
    pageW / 2,
    pageH - 8,
    { align: "center" }
  );

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
