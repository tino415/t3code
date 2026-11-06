import { RuntimeRequestId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { answeredQuestionCaption, answeredQuestionPairs, isAnsweredQuestion } from "./userInput.ts";

const requestId = RuntimeRequestId.make("question");
const file = {
  type: "file" as const,
  id: "f1",
  name: "notes.txt",
  mimeType: "text/plain",
  sizeBytes: 4,
};

describe("answered questions", () => {
  it("picks a bubble only when something was answered", () => {
    expect(isAnsweredQuestion({})).toBe(false);
    expect(
      isAnsweredQuestion({
        questionAnswer: { requestId, answers: {}, attachmentsByQuestionId: {} },
      }),
    ).toBe(false);
    expect(
      isAnsweredQuestion({
        questionAnswer: { requestId, answers: { a: "Blue" }, attachmentsByQuestionId: {} },
      }),
    ).toBe(true);
    expect(
      isAnsweredQuestion({
        questionAnswer: { requestId, answers: {}, attachmentsByQuestionId: { a: [file] } },
      }),
    ).toBe(true);
  });

  it("captions a single answer with its question", () => {
    const pairs = answeredQuestionPairs({
      requestId,
      questionTextById: { store: "Which store?" },
      answers: { store: "Postgres" },
      attachmentsByQuestionId: {},
    });
    expect(pairs).toMatchObject([{ question: "Which store?", answerText: "Postgres" }]);
    expect(answeredQuestionCaption(pairs)).toBe("You answered · Which store?");
  });

  it("pairs each question with its own answer and skips unanswered ones", () => {
    const pairs = answeredQuestionPairs({
      requestId,
      questionTextById: { store: "Which store?", keys: "Keep keys?", skipped: "Anything else?" },
      answers: { store: "Postgres", keys: ["No", "drop them"] },
      attachmentsByQuestionId: { skipped: [] },
    });
    expect(pairs.map((pair) => [pair.question, pair.answerText])).toEqual([
      ["Which store?", "Postgres"],
      ["Keep keys?", "No, drop them"],
    ]);
    expect(answeredQuestionCaption(pairs)).toBe("You answered 2 questions");
  });

  it("keeps an attachment-only answer", () => {
    const pairs = answeredQuestionPairs({
      requestId,
      questionTextById: { doc: "Send the doc" },
      answers: {},
      attachmentsByQuestionId: { doc: [file] },
    });
    expect(pairs).toMatchObject([{ answerText: "", attachments: [{ name: "notes.txt" }] }]);
  });
});
