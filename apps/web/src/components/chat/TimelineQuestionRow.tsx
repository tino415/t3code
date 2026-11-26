import {
  answeredQuestionPairs,
  isAnsweredQuestion,
  pickedOptionValues,
  questionOptionValue,
} from "@t3tools/client-runtime/work-log/user-input";
import {
  type OrchestrationV2UserInputQuestion,
  type UserInputAttachmentAnswerPayload,
  type UserInputAttachments,
} from "@t3tools/contracts";
import { use } from "react";
import { cn } from "~/lib/utils";
import { useAssetUrls } from "../../assets/assetUrls";
import { type WorkLogEntry } from "../../session-logic";
import ChatMarkdown from "../ChatMarkdown";
import { Badge } from "../ui/badge";
import { CheckboxMark } from "../ui/checkbox";
import { OptionRadio } from "./ComposerPendingUserInputPanel";
import { TimelineRowCtx } from "./timelineRowContext";
import { MessageAuthorHeading } from "./TimelineRowParts";

export function TimelineQuestionRow({ entry }: { entry: WorkLogEntry }) {
  const questions = questionsOf(entry);
  return (
    <div className="space-y-4">
      <QuestionBubble entry={entry} questions={questions} />
      {entry.questionAnswer && isAnsweredQuestion(entry) ? (
        <QuestionAnswerBubble answer={entry.questionAnswer} questions={questions} />
      ) : null}
    </div>
  );
}

function questionsOf(entry: WorkLogEntry): ReadonlyArray<OrchestrationV2UserInputQuestion> {
  if (entry.questions?.length) return entry.questions;
  return Object.entries(entry.questionAnswer?.questionTextById ?? {}).map(([id, question]) => ({
    id,
    header: "",
    question,
    options: [],
  }));
}

function QuestionBubble({
  entry,
  questions,
}: {
  entry: WorkLogEntry;
  questions: ReadonlyArray<OrchestrationV2UserInputQuestion>;
}) {
  const notAnswered = entry.toolLifecycleStatus !== "inProgress" && !isAnsweredQuestion(entry);
  return (
    <div className="relative min-w-0 rounded-2xl border border-border bg-card p-3">
      <MessageAuthorHeading>T3 Code</MessageAuthorHeading>
      {questions.length === 0 ? <QuestionHeading first header="" /> : null}
      {questions.map((question, index) => (
        <div key={question.id} className={cn(index > 0 && "mt-2.5 border-t border-border pt-2.5")}>
          <QuestionHeading first={index === 0} header={question.header} />
          <QuestionText question={question} />
          <QuestionOptions
            question={question}
            picked={pickedOptionValues(question, entry.questionAnswer)}
          />
        </div>
      ))}
      {notAnswered ? (
        <div className="mt-2">
          <Badge variant="outline" size="sm">
            Not answered
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

function QuestionHeading({ first, header }: { first: boolean; header: string }) {
  if (!first && !header) return null;
  return (
    <p className="mb-1 text-xs font-semibold text-muted-foreground">
      {first ? "T3 Code asked" : null}
      {first && header ? " · " : null}
      <span className="font-medium">{header}</span>
    </p>
  );
}

function QuestionText({ question }: { question: OrchestrationV2UserInputQuestion }) {
  const ctx = use(TimelineRowCtx);
  return (
    <ChatMarkdown
      text={question.question}
      cwd={ctx.markdownCwd}
      threadRef={ctx.threadRef ?? undefined}
    />
  );
}

function QuestionOptions({
  question,
  picked,
}: {
  question: OrchestrationV2UserInputQuestion;
  picked: ReadonlyArray<string>;
}) {
  if (question.options.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {question.options.map((option) => {
        const value = questionOptionValue(option);
        const isPicked = picked.includes(value);
        return (
          <li
            key={value}
            data-picked={isPicked || undefined}
            className={cn(
              "flex items-start gap-2.5 py-1",
              isPicked ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="flex h-5 shrink-0 items-center">
              {question.multiSelect ? (
                <CheckboxMark checked={isPicked} />
              ) : (
                <OptionRadio checked={isPicked} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">
                {option.label}
                {isPicked ? <span className="sr-only"> (picked)</span> : null}
              </span>
              {option.description !== option.label ? (
                <span className="text-2xs">{option.description}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionAnswerBubble({
  answer,
  questions,
}: {
  answer: UserInputAttachmentAnswerPayload;
  questions: ReadonlyArray<OrchestrationV2UserInputQuestion>;
}) {
  const pairs = answeredQuestionPairs(answer);
  const headerOf = (questionId: string) =>
    questions.find((question) => question.id === questionId)?.header;
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="max-w-[80%] text-xs text-muted-foreground">
        {pairs.length === 1 ? "You answered" : `You answered ${pairs.length} questions`}
      </p>
      <div className="min-w-0 max-w-[80%] space-y-2 rounded-2xl border-s-2 border-primary bg-message px-4 py-2.5 text-sm text-message-foreground">
        {pairs.map((pair, index) => (
          <div
            key={pair.questionId}
            className={cn("space-y-1", index > 0 && "border-t border-border/60 pt-2")}
          >
            {pairs.length > 1 && headerOf(pair.questionId) ? (
              <p className="text-xs text-muted-foreground">{headerOf(pair.questionId)}</p>
            ) : null}
            {pair.answerText ? <p className="whitespace-pre-wrap">{pair.answerText}</p> : null}
            <QuestionAnswerAttachments attachments={pair.attachments} />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionAnswerAttachments({
  attachments,
}: {
  attachments: ReadonlyArray<UserInputAttachments[string][number]>;
}) {
  const { activeThreadEnvironmentId } = use(TimelineRowCtx);
  const urls = useAssetUrls(
    activeThreadEnvironmentId,
    attachments.map((attachment) => ({
      _tag: "attachment" as const,
      attachmentId: attachment.id,
    })),
  );
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment, index) => {
        const url = urls[index];
        return (
          <a
            key={attachment.id}
            href={url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            {attachment.type === "image" && url ? (
              <img
                src={url}
                alt={attachment.name}
                className="h-20 max-w-32 rounded object-contain"
              />
            ) : (
              attachment.name
            )}
          </a>
        );
      })}
    </div>
  );
}
