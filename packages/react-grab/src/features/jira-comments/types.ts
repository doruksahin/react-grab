export interface JiraComment {
  id: string;
  parentId: string | null;
  author: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  sending?: boolean;
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

export interface JiraCommentEditorProps {
  onSubmit: (markdown: string, mentions: MentionMapping[]) => void;
  onCancel?: () => void;
  onSearchUsers?: (query: string) => Promise<JiraUserSuggestion[]>;
  placeholder?: string;
  initialContent?: string;
}

export interface InlineReplyEditorProps extends Pick<JiraCommentEditorProps, "onSubmit" | "onCancel" | "onSearchUsers"> {
  author: string;
  authorAvatar: string | null;
}

export interface CommentThreadProps extends Pick<InlineReplyEditorProps, "onSearchUsers"> {
  root: JiraComment;
  replies: JiraComment[];
  isReplying: boolean;
  onReply: () => void;
  onCancelReply: () => void;
  onSubmitReply: JiraCommentEditorProps["onSubmit"];
}

export interface JiraCommentsSectionProps {
  comments: ReadonlyArray<JiraComment>;
  onSubmitComment: (markdown: string, mentions: MentionMapping[], parentId?: string) => Promise<{ id: string; created: string }>;
  onSearchUsers?: (query: string) => Promise<JiraUserSuggestion[]>;
  onRefreshPoll: () => void;
}
