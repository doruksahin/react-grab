import { createSignal } from "solid-js";
import type { JiraComment, MentionMapping } from "./types.js";

interface UseJiraCommentsProps {
  serverComments: () => ReadonlyArray<JiraComment>;
  onSubmitComment: (markdown: string, mentions: MentionMapping[], parentId?: string) => Promise<{ id: string; created: string }>;
  onRefreshPoll: () => void;
}

export function useJiraComments(props: UseJiraCommentsProps) {
  const [optimistic, setOptimistic] = createSignal<JiraComment[]>([]);
  const [replyTo, setReplyTo] = createSignal<{ id: string; author: string } | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const mergedComments = (): JiraComment[] => [
    ...props.serverComments(),
    ...optimistic(),
  ];

  async function submitComment(markdown: string, mentions: MentionMapping[], parentId?: string) {
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: JiraComment = {
      id: tempId,
      parentId: parentId ?? null,
      author: "You",
      authorAvatar: null,
      body: markdown,
      createdAt: new Date().toISOString(),
      sending: true,
    };

    setOptimistic((prev) => [...prev, optimisticEntry]);
    setReplyTo(null);
    setError(null);

    try {
      await props.onSubmitComment(markdown, mentions, parentId);
      setOptimistic((prev) => prev.filter((c) => c.id !== tempId));
      props.onRefreshPoll();
    } catch (err) {
      setOptimistic((prev) => prev.filter((c) => c.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to post comment");
    }
  }

  return { mergedComments, replyTo, setReplyTo, submitComment, error };
}
