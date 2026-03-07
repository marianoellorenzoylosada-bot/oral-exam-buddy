import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ProgressPdfData {
  candidateName: string | null; // null = all candidates
  totalExams: number;
  avgScore: number;
  bestScore: number;
  exams: {
    title: string;
    date: string;
    level: string;
    language: string;
    score: number;
    band: string;
  }[];
  criteriaAverages: { name: string; average: number }[];
}

const BRAND: [number, number, number] = [30, 64, 175];
const MUTED: [number, number, number] = [100, 116, 139];
const SUCCESS: [number, number, number] = [5, 150, 105];
const WARNING: [number, number, number] = [217, 119, 6];
const DANGER: [number, number, number] = [220, 38, 38];

function scoreColor(pct: number): [number, number, number] {
  if (pct >= 80) return SUCCESS;
  if (pct >= 50) return WARNING;
  return DANGER;
}

export function generateProgressPdf(data: ProgressPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OralAssess AI", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Progress Report", margin, 18);
  const today = new Date().toLocaleDateString();
  doc.text(today, pageW - margin, 18, { align: "right" });

  y = 36;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.candidateName ? `Progress: ${data.candidateName}` : "Progress: All Candidates", margin, y);
  y += 10;

  // Summary stats
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Total Exams: ${data.totalExams}    |    Average Score: ${data.avgScore.toFixed(1)}/5    |    Best Score: ${data.bestScore.toFixed(1)}/5`, margin, y);
  y += 10;

  // Criteria averages table
  if (data.criteriaAverages.length > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Criteria Averages", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Criterion", "Average Score"]],
      body: data.criteriaAverages.map((c) => [c.name, `${c.average.toFixed(2)} / 5`]),
      headStyles: { fillColor: BRAND, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" } },
      didParseCell(hookData) {
        if (hookData.section === "body" && hookData.column.index === 1) {
          const c = data.criteriaAverages[hookData.row.index];
          if (c) hookData.cell.styles.textColor = scoreColor((c.average / 5) * 100);
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Exams table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Exam History", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "Title", "Level", "Language", "Score", "Band"]],
    body: data.exams.map((e) => [e.date, e.title, e.level, e.language, `${e.score.toFixed(1)}/5`, e.band]),
    headStyles: { fillColor: BRAND, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7, cellPadding: 2.5 },
    columnStyles: { 4: { halign: "center" }, 5: { halign: "center" } },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("© 2026 OralAssess AI · Progress Report", pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    doc.text(`${p} / ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const label = data.candidateName?.replace(/\s+/g, "_") ?? "All";
  doc.save(`Progress_${label}_${today.replace(/\//g, "-")}.pdf`);
}
