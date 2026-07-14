import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListChecks, MessageSquareText } from "lucide-react";
import { getPartsForLevel, type PartFeedback } from "@/lib/partFeedback";

interface Props {
  levelCode: string;
  partFeedback?: PartFeedback[];
  overallSummary?: string;
  /** Used as a soft fallback for the Overall Summary on legacy reports. */
  fallbackSummary?: string;
}

const NO_EVIDENCE = /no evidence|not covered|n\/?a\b|insufficient/i;

function isMeaningful(pf?: PartFeedback): boolean {
  if (!pf) return false;
  const c = (pf.commentary ?? "").trim();
  const hasBreakdown = Array.isArray(pf.criteriaBreakdown) && pf.criteriaBreakdown.length > 0;
  if (!c && !hasBreakdown) return false;
  if (c && NO_EVIDENCE.test(c) && !hasBreakdown) return false;
  return true;
}

export function hasPartFeedbackContent(
  partFeedback?: PartFeedback[],
  overallSummary?: string
): boolean {
  const anyPart = (partFeedback ?? []).some(isMeaningful);
  const anySummary = (overallSummary ?? "").trim().length > 0;
  return anyPart || anySummary;
}

export function PartFeedbackSection({ levelCode, partFeedback, overallSummary, fallbackSummary }: Props) {
  const parts = getPartsForLevel(levelCode);
  const cleaned = (partFeedback ?? []).filter(isMeaningful);
  const byLabel = new Map(cleaned.map((p) => [p.part.toLowerCase(), p]));

  const summary = (overallSummary ?? "").trim() || (fallbackSummary ?? "").trim();
  const hasAnyPart = cleaned.length > 0;

  if (!hasAnyPart && !summary) return null;

  const defaultOpen = hasAnyPart
    ? (cleaned[0]?.part ?? parts[0]?.part ?? "summary")
    : "summary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-4 w-4 text-primary" />
          Examiner feedback by exam part
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyPart && (
          <p className="mb-3 text-xs text-muted-foreground italic">
            Per-part commentary is unavailable for this recording — see the criterion feedback for details.
          </p>
        )}

        <Accordion type="single" collapsible defaultValue={defaultOpen} className="w-full">
          {hasAnyPart && parts.map(({ part, title }) => {
            const pf = byLabel.get(part.toLowerCase());
            return (
              <AccordionItem key={part} value={part}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-medium">{part}</span>
                    <span className="text-muted-foreground">— {pf?.title || title}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {pf ? (
                    <div className="space-y-3">
                      {pf.commentary && (
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {pf.commentary}
                        </p>
                      )}

                      {Array.isArray(pf.criteriaBreakdown) && pf.criteriaBreakdown.length > 0 && (
                        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                          <p className="text-xs font-semibold text-foreground/80">By criterion:</p>
                          <ul className="space-y-1.5">
                            {pf.criteriaBreakdown.map((cb, i) => (
                              <li key={i} className="text-sm">
                                <span className="font-medium text-foreground">{cb.criterion}:</span>{" "}
                                <span className="text-foreground/80">{cb.comment}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Legacy observations (kept for backward compatibility) */}
                      {(!pf.criteriaBreakdown || pf.criteriaBreakdown.length === 0) &&
                        pf.observations && pf.observations.length > 0 && (
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {pf.observations.map((o, i) => (
                              <li key={i} className="flex gap-2">
                                <span aria-hidden className="text-primary">•</span>
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                      {(!pf.criteriaBreakdown || pf.criteriaBreakdown.length === 0) &&
                        pf.criteriaTouched && pf.criteriaTouched.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pf.criteriaTouched.map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px] font-normal">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}

                      {pf.improvement && (
                        <div className="flex gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
                          <ListChecks className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                          <span className="text-foreground/80">
                            <span className="font-medium">Suggested focus:</span> {pf.improvement}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Not covered in this recording.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}

          {summary && (
            <AccordionItem value="summary">
              <AccordionTrigger className="text-sm">
                <span className="font-medium text-left">Overall Summary</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{summary}</p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
