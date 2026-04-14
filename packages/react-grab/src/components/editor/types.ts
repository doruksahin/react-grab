export interface JiraCommentEditorProps {
  onSubmit: (markdown: string, mentions: Array<{ text: string; accountId: string }>) => void;
  onCancel?: () => void;
  onSearchUsers?: (query: string) => Promise<Array<{ accountId: string; displayName: string; avatarUrl: string | null }>>;
  replyTo?: { id: string; author: string } | null;
  onCancelReply?: () => void;
}

export interface MentionMapping {
  text: string;
  accountId: string;
}

export interface JiraUserSuggestion {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}
