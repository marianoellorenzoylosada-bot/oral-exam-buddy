import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PartFeedback } from "@/lib/partFeedback";
import { buildTeacherReportModel } from "@/lib/teacherReportModel";

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
  /** "save" downloads the file (default); "print" opens the print dialog; "blob" returns a Blob for sharing. */
  output?: "save" | "print" | "blob";
}

export type { ReportData };

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

/**
 * Teacher report PDF. Rendered from the shared teacher-report model so the file
 * always matches the on-screen report: compact marks table, then
 * Part → relevant criteria → evidence, then synthesis, evidence lists,
 * examiner notes and the full transcript.
 */
export function generateReportPdf(input: ReportData): Blob | void {
  const model = buildTeacherReportModel({
    ...input,
    strengths: input.strengths,
    areasForImprovement: input.areasForImprovement,
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };

  const paragraph = (
    text: string,
    opts: { size?: number; style?: "normal" | "bold" | "italic"; color?: [number, number, number]; indent?: number; lh?: number } = {}
  ) => {
    const { size = 8, style = "normal", color = [0, 0, 0] as [number, number, number], indent = 0, lh = 4 } = opts;
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW - indent);
    lines.forEach((line: string) => {
      ensure(lh);
      doc.text(line, margin + indent, y);
      y += lh;
    });
  };

  const heading = (text: string, color: [number, number, number] = [0, 0, 0], size = 11) => {
    ensure(size / 2 + 6);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(text, margin, y);
    y += 5;
  };

  // --- Header bar ---
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OralAssess AI", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Teacher Report", margin, 18);
  doc.text(model.date, pageW - margin, 18, { align: "right" });

  // Institution & meta
  y = 36;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  const metaLine = [model.institution, model.group, model.levelCode, model.language].filter(Boolean).join("  ·  ");
  if (metaLine) {
    doc.text(metaLine, margin, y);
    y += 5;
  }

  // --- Title ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(model.title, contentW);
  titleLines.forEach((line: string) => {
    y += 6;
    doc.text(line, margin, y);
  });
  y += 2;

  // Only when the title does not already name the candidate (avoids repetition).
  if (model.candidateName && !model.title.toLowerCase().includes(model.candidateName.trim().toLowerCase())) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    y += 5;
    doc.text(`Candidate: ${model.candidateName}`, margin, y);
  }

  y += 6;

  // --- Overall score box ---
  const boxH = 20;
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, y, contentW, boxH, 3, 3, "F");
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(margin + 4, y + 3, 20, boxH - 6, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(model.levelCode || "—", margin + 14, y + boxH / 2 + 1.5, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.text(
    `${model.overallBand} · Overall ${model.overallScore.toFixed(1)} / 5.0`,
    margin + 30,
    y + 8.5,
    { maxWidth: contentW - 36 }
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Diagnostic estimate — not an official Cambridge result.", margin + 30, y + 14.5);
  y += boxH + 8;

  // --- Marks ---
  if (model.marks.length > 0) {
    if (model.criteriaOnly) {
      // Legacy reports with no per-part content: keep the narrative table.
      heading("Assessment Criteria", [0, 0, 0], 12);
      y -= 3;
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Criterion", "Mark", "Feedback"]],
        body: model.marks.map((m) => [m.name, `${m.score} / ${m.maxScore}`, m.feedback ?? ""]),
        headStyles: { fillColor: BRAND_COLOR, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: "bold" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: "auto" },
        },
        didParseCell(hookData) {
          if (hookData.section === "body" && hookData.column.index === 1) {
            const m = model.marks[hookData.row.index];
            if (m) {
              hookData.cell.styles.textColor = scoreColor((m.score / m.maxScore) * 100);
              hookData.cell.styles.fontStyle = "bold";
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      // Compact marks strip — same presentation as the student report.
      heading("Marks", [0, 0, 0], 12);
      y -= 1;
      const cellW = contentW / model.marks.length;
      const nameSize = model.marks.length >= 5 ? 6.4 : 7.2;
      doc.setFontSize(nameSize);
      doc.setFont("helvetica", "normal");
      const nameLines = model.marks.map((m) => doc.splitTextToSize(m.name, cellW - 2.5) as string[]);
      const maxNameLines = nameLines.reduce((mx, l) => Math.max(mx, l.length), 1);
      const stripH = 4 + maxNameLines * 2.9 + 6;
      ensure(stripH + 4);
      doc.setDrawColor(225, 232, 240);
      doc.setFillColor(246, 249, 255);
      doc.roundedRect(margin, y, contentW, stripH, 2, 2, "FD");
      model.marks.forEach((m, i) => {
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
        doc.setTextColor(...scoreColor((m.score / m.maxScore) * 100));
        doc.text(`${m.score}/${m.maxScore}`, cx, y + stripH - 2, { align: "center" });
      });
      y += stripH + 8;
    }
  }


  // --- Part → relevant criteria → evidence ---
  if (model.parts.length > 0) {
    heading("Analysis by Exam Part", [0, 0, 0], 12);

    for (const p of model.parts) {
      ensure(18);
      doc.setFillColor(...BRAND_COLOR);
      doc.setDrawColor(...BRAND_COLOR);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text([p.part, p.title].filter(Boolean).join(" — "), margin + 3, y + 5);
      y += 10;

      if (p.commentary) {
        paragraph(p.commentary, { style: "italic" });
        y += 2;
      }

      for (const cb of p.criteria) {
        const labelWidth = 52;
        ensure(6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text(`• ${cb.criterion}:`, margin + 2, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        const commentLines = doc.splitTextToSize(cb.comment, contentW - labelWidth - 4);
        commentLines.forEach((line: string, i: number) => {
          if (i > 0) ensure(4);
          doc.text(line, margin + 2 + labelWidth, y);
          if (i < commentLines.length - 1) y += 4;
        });
        y += 4.5;
      }

      if (p.improvement) {
        // Measure with the exact font used for drawing, otherwise the text
        // overflows the amber box.
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const impLines: string[] = doc.splitTextToSize(`Suggested focus: ${p.improvement}`, contentW - 10);
        const h = impLines.length * 4 + 5;
        ensure(h + 3);
        doc.setFillColor(255, 247, 230);
        doc.setDrawColor(...WARNING);
        doc.roundedRect(margin, y, contentW, h, 1.5, 1.5, "FD");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 80, 20);
        let ty = y + 4.5;
        impLines.forEach((line: string) => {
          doc.text(line, margin + 4, ty);
          ty += 4;
        });
        y += h + 3;
      }


      y += 3;
    }
  }

  // --- Synthesis ---
  if (model.overallSummary) {
    heading("Overall Summary", [0, 0, 0], 11);
    paragraph(model.overallSummary);
    y += 4;
  }

  // --- Evidence lists ---
  if (model.strengths.length > 0) {
    heading("Strengths", SUCCESS, 10);
    model.strengths.forEach((s) => paragraph(`•  ${s}`, { indent: 2 }));
    y += 4;
  }

  if (model.areasForImprovement.length > 0) {
    heading("Areas for Improvement", WARNING, 10);
    model.areasForImprovement.forEach((a) => paragraph(`•  ${a}`, { indent: 2 }));
    y += 4;
  }

  // --- Examiner Notes ---
  if (model.examinerNotes) {
    heading("Examiner Notes", [0, 0, 0], 10);
    paragraph(model.examinerNotes, { color: MUTED });
    y += 4;
  }

  // --- Full transcript ---
  if (model.transcript) {
    heading("Full Transcript", [0, 0, 0], 10);
    paragraph(model.transcript, { size: 7, color: MUTED, lh: 3.5 });
    y += 4;
  }

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "© 2026 OralAssess AI · Teacher Report · AI results subject to teacher supervision",
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(`${p} / ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const filename = `${model.title.replace(/\s+/g, "_")}_${model.date.replace(/\//g, "-")}.pdf`;
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
