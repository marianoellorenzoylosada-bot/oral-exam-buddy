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
}

const BRAND: [number, number, number] = [30, 64, 175];
const MUTED: [number, number, number] = [100, 116, 139];
const SUCCESS: [number, number, number] = [5, 150, 105];
const WARNING: [number, number, number] = [217, 119, 6];

/**
 * Friendly student-facing PDF. Strips examiner notes, transcript and
 * confidence scores; rephrases tone in second person; keeps the score,
 * key takeaways and practice suggestions.
 */
export function generateStudentPdf(data: StudentReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // --- Header ---
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Your Speaking Feedback", margin, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.levelCode} · ${data.language}`, margin, 19);
  doc.text(data.date, pageW - margin, 19, { align: "right" });

  y = 38;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Hi ${data.candidateName || "there"},`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  const intro = doc.splitTextToSize(
    `Here's a friendly summary of your recent ${data.title} speaking session. Use it to celebrate what's going well and to focus your practice on what will help you most.`,
    pageW - margin * 2,
  );
  intro.forEach((line: string) => { doc.text(line, margin, y); y += 5; });
  y += 4;

  // --- Overall band ---
  const boxH = 24;
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, "F");
  doc.setFillColor(...BRAND);
  doc.roundedRect(margin + 4, y + 3, 26, boxH - 6, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.overallBand, margin + 17, y + boxH / 2 + 2, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Your overall band", margin + 36, y + 9);
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Score: ${data.overallScore.toFixed(1)} / 5.0`, margin + 36, y + 16);
  y += boxH + 8;

  // --- Per-skill scores (no confidence, simpler labels) ---
  if (data.criteria.length > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("How you did, skill by skill", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Skill", "Band"]],
      body: data.criteria.map((c) => [c.name, `${c.score} / ${c.maxScore}`]),
      headStyles: { fillColor: BRAND, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: "auto", fontStyle: "bold" },
        1: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- What you did well ---
  if (data.strengths.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SUCCESS);
    doc.text("What you did well", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    data.strengths.forEach((s) => {
      const text = `•  ${s}`;
      const lines = doc.splitTextToSize(text, pageW - margin * 2 - 4);
      lines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(line, margin + 2, y);
        y += 4.5;
      });
    });
    y += 4;
  }

  // --- What to practise next ---
  if (data.areasForImprovement.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WARNING);
    doc.text("What to practise next", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    data.areasForImprovement.forEach((a) => {
      const text = `•  ${a}`;
      const lines = doc.splitTextToSize(text, pageW - margin * 2 - 4);
      lines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(line, margin + 2, y);
        y += 4.5;
      });
    });
    y += 4;
  }

  // --- Practice links ---
  if (data.practice && data.practice.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND);
    doc.text("Try these to keep improving", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    data.practice.forEach((p) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.setTextColor(0, 0, 0);
      doc.text(`•  ${p.title}`, margin + 2, y);
      y += 4;
      doc.setTextColor(...BRAND);
      doc.textWithLink(`   ${p.url}`, margin + 2, y, { url: p.url });
      y += 5;
    });
  }

  // --- Footer ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "© 2026 OralAssess AI · Student feedback summary · Discuss with your teacher for full details.",
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(`${p} / ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const safeName = (data.candidateName || "student").replace(/\s+/g, "_");
  const filename = `Student_Feedback_${safeName}_${data.date.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
