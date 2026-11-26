import {
  type OrchestrationV2UserInputQuestion,
  type UserInputAttachmentAnswerPayload,
} from "@t3tools/contracts";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function answerValues(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(answerValues);
  const nested = record(value);
  return nested ? answerValues(nested.answers) : [];
}

export function getQuestionAnswerText(value: unknown): string {
  return answerValues(value).join(", ");
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

export interface AnsweredQuestionDetail {
  readonly questionId: string;
  readonly header: string;
  readonly question: string;
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    readonly picked: boolean;
  }>;
  readonly typedOwnAnswer: boolean;
}

export function questionOptionValue(option: OrchestrationV2UserInputQuestion["options"][number]) {
  return option.value ?? option.label;
}

export function pickedOptionValues(
  question: OrchestrationV2UserInputQuestion,
  answer: UserInputAttachmentAnswerPayload | undefined,
): string[] {
  const given = answerValues(answer?.answers[question.id]);
  return question.options.map(questionOptionValue).filter((value) => given.includes(value));
}

export function answeredQuestionDetails(
  questions: ReadonlyArray<OrchestrationV2UserInputQuestion>,
  answer: UserInputAttachmentAnswerPayload,
): AnsweredQuestionDetail[] {
  return questions
    .filter((question) => question.options.length > 0)
    .map((question) => {
      const picked = pickedOptionValues(question, answer);
      const options = question.options.map((option) => ({
        label: option.label,
        description: option.description,
        picked: picked.includes(questionOptionValue(option)),
      }));
      return {
        questionId: question.id,
        header: question.header,
        question: question.question,
        options,
        typedOwnAnswer: picked.length === 0 && answerValues(answer.answers[question.id]).length > 0,
      };
    });
}
