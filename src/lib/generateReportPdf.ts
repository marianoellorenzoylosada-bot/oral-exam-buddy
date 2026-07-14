import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PartFeedback } from "@/lib/partFeedback";
import { getPartsForLevel } from "@/lib/partFeedback";

interface CriterionData {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface ReportData {
  title: string;
  candidateName?: string;
  institution: string;
  group: string;
  levelCode: string;
  language: string;
  overallBand: string;
  overallScore: number;
  criteria: CriterionData[];
  strengths: string[];
  areasForImprovement: string[];
  examinerNotes: string;
  transcript: string;
  date: string;
  /** Per-part × per-criterion feedback (optional; falls back to legacy layout if missing). */
  partFeedback?: PartFeedback[];
  /** Short synthesis paragraph for the whole exam. */
  overallSummary?: string;
}

const BRAND_COLOR: [number, number, number] = [30, 64, 175]; // blue-800
const MUTED: [number, number, number] = [100, 116, 139]; // slate-500
const SUCCESS: [number, number, number] = [5, 150, 105]; // emerald-600
const WARNING: [number, number, number] = [217, 119, 6]; // amber-600
const DANGER: [number, number, number] = [220, 38, 38]; // red-600

function scoreColor(pct: number): [number, number, number] {
  if (pct >= 80) return SUCCESS;
  if (pct >= 50) return WARNING;
  return DANGER;
}

export function generateReportPdf(data: ReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // --- Header bar ---
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OralAssess AI", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Official Assessment Report", margin, 18);
  doc.text(data.date, pageW - margin, 18, { align: "right" });

  // Institution & meta
  y = 36;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  const metaLine = [data.institution, data.group, data.levelCode, data.language].filter(Boolean).join("  ·  ");
  doc.text(metaLine, margin, y);
  y += 4;

  // --- Title ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.title, margin, y + 8);
  y += 14;

  // Candidate name
  if (data.candidateName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Candidate: ${data.candidateName}`, margin, y);
    y += 6;
  }

  // --- Overall score box ---
  const boxH = 22;
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, "F");
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(margin + 4, y + 3, 24, boxH - 6, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.overallBand, margin + 16, y + boxH / 2 + 2, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`Overall Score: ${data.overallScore.toFixed(1)} / 5.0`, margin + 34, y + 9);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("CEFR Band Assessment", margin + 34, y + 15);
  y += boxH + 8;

  const meaningfulParts = (data.partFeedback ?? []).filter((p) => {
    const c = (p?.commentary ?? "").trim();
    const hasBreakdown = Array.isArray(p?.criteriaBreakdown) && p!.criteriaBreakdown!.length > 0;
    return !!(c || hasBreakdown);
  });
  const hasPartFeedback = meaningfulParts.length > 0;

  // --- Criteria table ---
  // When per-part feedback is available, the criterion narrative moves into
  // each part below and this table becomes a compact score summary.
  if (data.criteria.length > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(hasPartFeedback ? "Assessment Criteria — Score Summary" : "Assessment Criteria", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: hasPartFeedback ? [["Criterion", "Score"]] : [["Criterion", "Score", "Feedback"]],
      body: data.criteria.map((c) =>
        hasPartFeedback
          ? [c.name, `${c.score} / ${c.maxScore}`]
          : [c.name, `${c.score} / ${c.maxScore}`, c.feedback]
      ),
      headStyles: {
        fillColor: BRAND_COLOR,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: hasPartFeedback
        ? {
            0: { cellWidth: "auto", fontStyle: "bold" },
            1: { cellWidth: 30, halign: "center" },
          }
        : {
            0: { cellWidth: 35, fontStyle: "bold" },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: "auto" },
          },
      didParseCell(hookData) {
        if (hookData.section === "body" && hookData.column.index === 1) {
          const c = data.criteria[hookData.row.index];
          if (c) {
            const pct = (c.score / c.maxScore) * 100;
            hookData.cell.styles.textColor = scoreColor(pct);
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- Feedback by Exam Part ---
  if (hasPartFeedback) {
    const parts = getPartsForLevel(data.levelCode);
    const byLabel = new Map(meaningfulParts.map((p) => [p.part.toLowerCase(), p]));

    if (y > 240) { doc.addPage(); y = margin; }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Feedback by Exam Part", margin, y);
    y += 6;

    const contentW = pageW - margin * 2;

    for (const { part, title } of parts) {
      const pf = byLabel.get(part.toLowerCase());
      if (!pf) continue;

      // Reserve enough space for at least the part heading + a couple lines.
      if (y > 260) { doc.addPage(); y = margin; }

      // Part heading bar
      doc.setFillColor(...BRAND_COLOR);
      doc.setDrawColor(...BRAND_COLOR);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${part} — ${pf.title || title}`, margin + 3, y + 5);
      y += 10;

      // Overview commentary
      if (pf.commentary && pf.commentary.trim()) {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        const cLines = doc.splitTextToSize(pf.commentary.trim(), contentW);
        cLines.forEach((line: string) => {
          if (y > 275) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 4;
        });
        y += 2;
      }

      // Criterion breakdown
      if (Array.isArray(pf.criteriaBreakdown) && pf.criteriaBreakdown.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        for (const cb of pf.criteriaBreakdown) {
          if (y > 272) { doc.addPage(); y = margin; }
          const labelWidth = 55; // mm reserved for criterion label
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...BRAND_COLOR);
          doc.text(`• ${cb.criterion}:`, margin + 2, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const commentLines = doc.splitTextToSize(cb.comment || "—", contentW - labelWidth - 4);
          commentLines.forEach((line: string, i: number) => {
            if (y > 275) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2 + labelWidth, y);
            if (i < commentLines.length - 1) y += 4;
          });
          y += 4.5;
        }
      }

      // Improvement callout
      if (pf.improvement && pf.improvement.trim()) {
        if (y > 268) { doc.addPage(); y = margin; }
        doc.setFillColor(255, 247, 230);
        doc.setDrawColor(...WARNING);
        const impLines = doc.splitTextToSize(`Suggested focus: ${pf.improvement.trim()}`, contentW - 6);
        const boxH = impLines.length * 4 + 4;
        doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, "FD");
        doc.setTextColor(...WARNING);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        let ty = y + 4;
        impLines.forEach((line: string, i: number) => {
          if (i === 0) {
            doc.setFont("helvetica", "bold");
          } else {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 60, 20);
          }
          doc.text(line, margin + 3, ty);
          ty += 4;
        });
        y += boxH + 3;
      }

      y += 3;
    }

    // Overall Summary
    if (data.overallSummary && data.overallSummary.trim()) {
      if (y > 245) { doc.addPage(); y = margin; }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Overall Summary", margin, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const sLines = doc.splitTextToSize(data.overallSummary.trim(), pageW - margin * 2);
      sLines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 4;
      });
      y += 4;
    }
  }


  // --- Strengths & Areas for improvement ---
  const halfW = (pageW - margin * 2 - 6) / 2;

  if (data.strengths.length > 0 || data.areasForImprovement.length > 0) {
    // Check page space
    if (y > 230) { doc.addPage(); y = margin; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    if (data.strengths.length > 0) {
      doc.setTextColor(...SUCCESS);
      doc.text("✓ Strengths", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      data.strengths.forEach((s, i) => {
        y += 5;
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(`•  ${s}`, margin + 2, y, { maxWidth: halfW - 4 });
        const lines = doc.splitTextToSize(`•  ${s}`, halfW - 4);
        y += (lines.length - 1) * 4;
      });
    }

    let yRight = y - (data.strengths.length > 0 ? data.strengths.length * 5 + (data.strengths.length - 1) * 0 : 0);
    // Simpler: just put improvements below strengths
    y += 6;

    if (data.areasForImprovement.length > 0) {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WARNING);
      doc.text("△ Areas for Improvement", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      data.areasForImprovement.forEach((a) => {
        y += 5;
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(`•  ${a}`, margin + 2, y, { maxWidth: pageW - margin * 2 - 4 });
        const lines = doc.splitTextToSize(`•  ${a}`, pageW - margin * 2 - 4);
        y += (lines.length - 1) * 4;
      });
      y += 6;
    }
  }

  // --- Examiner Notes ---
  if (data.examinerNotes) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Examiner Notes", margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(data.examinerNotes, pageW - margin * 2);
    noteLines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 4;
    });
    y += 4;
  }

  // --- Transcript ---
  if (data.transcript) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Transcript", margin, y);
    y += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const tLines = doc.splitTextToSize(data.transcript, pageW - margin * 2);
    tLines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 3.5;
    });
    y += 4;
  }

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "© 2026 OralAssess AI · Official Assessment Report · AI results subject to teacher supervision",
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(`${p} / ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  // Save
  const filename = `${data.title.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
