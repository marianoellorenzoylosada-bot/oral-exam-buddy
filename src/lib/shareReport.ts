import { supabase } from "@/integrations/supabase/client";
import type { ReportData } from "@/lib/generateReportPdf";
import type { StudentReportData } from "@/lib/generateStudentPdf";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { generateStudentPdf } from "@/lib/generateStudentPdf";

export type ShareablePdfType = "teacher" | "student";

export interface ShareablePdfInput {
  type: ShareablePdfType;
  userId: string;
  fileNamePrefix: string;
  pdfData: ReportData | StudentReportData;
}

const BUCKET = "shared-reports";
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function createShareablePdfLink(input: ShareablePdfInput): Promise<string> {
  const { type, userId, fileNamePrefix, pdfData } = input;

  const blob =
    type === "teacher"
      ? generateReportPdf({ ...(pdfData as ReportData), output: "blob" })
      : generateStudentPdf({ ...(pdfData as StudentReportData), output: "blob" });

  if (!(blob instanceof Blob)) {
    throw new Error("PDF generation did not return a file.");
  }

  const safePrefix = fileNamePrefix.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  const filename = `${safePrefix}_${type}_${Date.now()}.pdf`;
  const path = `${userId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: false });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not create signed link.");
  return data.signedUrl;
}

export function buildShareMessage(candidateName: string, link: string): string {
  return `Here is the speaking assessment report for ${candidateName || "the candidate"}.\n\n${link}\n\nThe link is valid for 7 days.`;
}

export function openWhatsAppShare(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openEmailShare(subject: string, body: string): void {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
