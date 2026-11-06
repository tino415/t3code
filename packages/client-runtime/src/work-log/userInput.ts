import { type UserInputAttachmentAnswerPayload } from "@t3tools/contracts";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function getQuestionAnswerText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(getQuestionAnswerText).filter(Boolean).join(", ");
  const nested = record(value);
  return nested ? getQuestionAnswerText(nested.answers) : "";
}

export function getQuestionTextPreview(answer: UserInputAttachmentAnswerPayload): string {
  return Object.values(answer.questionTextById ?? {})
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ");
}

export function getQuestionAnswerPreview(answer: UserInputAttachmentAnswerPayload): string {
  const answers = Object.values(answer.answers).map(getQuestionAnswerText).filter(Boolean);
  const attachments = Object.values(answer.attachmentsByQuestionId)
    .flat()
    .map((attachment) => attachment.name);
  return (
    answers.length > 0
      ? answers.join(" · ")
      : attachments.length > 0
        ? attachments.join(", ")
        : Object.values(answer.questionTextById ?? {}).join(" · ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function hasQuestionAnswer(answer: UserInputAttachmentAnswerPayload): boolean {
  return (
    Object.values(answer.answers).some(getQuestionAnswerText) ||
    Object.values(answer.attachmentsByQuestionId).some((attachments) => attachments.length > 0)
  );
}

export function isAnsweredQuestion(entry: {
  readonly questionAnswer?: UserInputAttachmentAnswerPayload;
}): boolean {
  return entry.questionAnswer !== undefined && hasQuestionAnswer(entry.questionAnswer);
}

export interface AnsweredQuestionPair {
  readonly questionId: string;
  readonly question: string | undefined;
  readonly answerText: string;
  readonly attachments: UserInputAttachmentAnswerPayload["attachmentsByQuestionId"][string];
}

export function answeredQuestionPairs(
  answer: UserInputAttachmentAnswerPayload,
): AnsweredQuestionPair[] {
  return [
    ...new Set([
      ...Object.keys(answer.questionTextById ?? {}),
      ...Object.keys(answer.answers),
      ...Object.keys(answer.attachmentsByQuestionId),
    ]),
  ].flatMap((questionId) => {
    const answerText = getQuestionAnswerText(answer.answers[questionId]);
    const attachments = answer.attachmentsByQuestionId[questionId] ?? [];
    return answerText || attachments.length > 0
      ? [{ questionId, question: answer.questionTextById?.[questionId], answerText, attachments }]
      : [];
  });
}

export function answeredQuestionCaption(pairs: ReadonlyArray<AnsweredQuestionPair>): string {
  const [only] = pairs;
  if (pairs.length !== 1 || !only) return `You answered ${pairs.length} questions`;
  return only.question ? `You answered · ${only.question}` : "You answered";
}
