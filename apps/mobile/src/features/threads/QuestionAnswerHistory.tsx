import type {
  EnvironmentId,
  UserInputAttachmentAnswerPayload,
  UserInputAttachments,
} from "@t3tools/contracts";
import { Image } from "expo-image";
import { Linking, Pressable, View, type ColorValue } from "react-native";
import {
  answeredQuestionCaption,
  answeredQuestionPairs,
  getQuestionAnswerText,
} from "@t3tools/client-runtime/work-log/user-input";
import { AppText as Text } from "../../components/ui/AppText";
import { assetImageSource } from "../../lib/assetImageSource";
import { useAssetUrl } from "../../state/assets";

function AnswerFile(props: {
  environmentId: EnvironmentId;
  attachment: UserInputAttachments[string][number];
  textClassName?: string;
}) {
  const resource = { _tag: "attachment", attachmentId: props.attachment.id } as const;
  const url = useAssetUrl(props.environmentId, resource);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={props.attachment.name}
      disabled={!url}
      onPress={() => {
        if (url) void Linking.openURL(url);
      }}
      className="gap-1"
    >
      {props.attachment.type === "image" && url ? (
        <Image
          source={assetImageSource(props.environmentId, resource, url)}
          cachePolicy="memory-disk"
          style={{ width: 160, height: 96 }}
          contentFit="contain"
        />
      ) : null}
      <Text className={`text-sm underline ${props.textClassName ?? "text-foreground"}`}>
        {props.attachment.name}
      </Text>
    </Pressable>
  );
}

function questionIds(answer: UserInputAttachmentAnswerPayload): string[] {
  return [
    ...new Set([
      ...Object.keys(answer.questionTextById ?? {}),
      ...Object.keys(answer.answers),
      ...Object.keys(answer.attachmentsByQuestionId),
    ]),
  ];
}

export function QuestionAnswerHistory(props: {
  environmentId: EnvironmentId;
  answer: UserInputAttachmentAnswerPayload;
}) {
  return (
    <View className="gap-2">
      {questionIds(props.answer).map((questionId) => (
        <View key={questionId} className="gap-1">
          {props.answer.questionTextById?.[questionId] ? (
            <Text className="text-sm text-foreground-muted">
              {props.answer.questionTextById[questionId]}
            </Text>
          ) : null}
          {getQuestionAnswerText(props.answer.answers[questionId]) ? (
            <Text className="ml-3 text-sm text-foreground-muted">
              {getQuestionAnswerText(props.answer.answers[questionId])}
            </Text>
          ) : null}
          {(props.answer.attachmentsByQuestionId[questionId] ?? []).map((attachment) => (
            <AnswerFile
              key={attachment.id}
              environmentId={props.environmentId}
              attachment={attachment}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function QuestionAnswerBubble(props: {
  environmentId: EnvironmentId;
  answer: UserInputAttachmentAnswerPayload;
  bubbleColor: ColorValue;
  maxWidth: number | `${number}%`;
}) {
  const pairs = answeredQuestionPairs(props.answer);
  const labelled = pairs.length > 1;
  return (
    <View className="items-end gap-1 py-1.5" style={{ maxWidth: "100%" }}>
      <Text className="text-xs text-foreground-muted" style={{ maxWidth: props.maxWidth }}>
        {answeredQuestionCaption(pairs)}
      </Text>
      <View
        className="min-w-0 flex-row overflow-hidden rounded-[20px]"
        style={{ backgroundColor: props.bubbleColor, maxWidth: props.maxWidth }}
      >
        <View className="w-[3px] self-stretch bg-primary" />
        <View className="min-w-0 shrink gap-2 px-3.5 py-2.5">
          {pairs.map((pair, index) => (
            <View
              key={pair.questionId}
              className={index > 0 ? "gap-1 border-t border-border pt-2" : "gap-1"}
            >
              {labelled && pair.question ? (
                <Text className="text-xs text-user-bubble-foreground-muted">{pair.question}</Text>
              ) : null}
              {pair.answerText ? (
                <Text className="text-base text-user-bubble-foreground">{pair.answerText}</Text>
              ) : null}
              {pair.attachments.map((attachment) => (
                <AnswerFile
                  key={attachment.id}
                  environmentId={props.environmentId}
                  attachment={attachment}
                  textClassName="text-user-bubble-foreground"
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
