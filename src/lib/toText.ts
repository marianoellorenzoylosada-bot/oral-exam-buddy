/**
 * Coerce AI-provided values into readable plain text.
 *
 * The analysis model sometimes returns objects (e.g. { criterion, comment })
 * where a plain string is expected, which used to render as "(object) (object)"
 * in the PDF and UI. This normalises those shapes into a single line of text.
 */
export function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(" — ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const label = toText(obj.criterion ?? obj.name ?? obj.title ?? obj.area ?? obj.part ?? "");
    const body = toText(
      obj.comment ?? obj.text ?? obj.detail ?? obj.description ?? obj.feedback ?? obj.value ?? ""
    );
    if (label && body) return `${label}: ${body}`;
    if (body) return body;
    if (label) return label;
    return Object.values(obj).map(toText).filter(Boolean).join(" — ");
  }
  return "";
}

/** Normalise a list of AI-provided values into readable, non-empty strings. */
export function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return value == null ? [] : [toText(value)].filter(Boolean);
  return value.map(toText).map((s) => s.trim()).filter(Boolean);
}
