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

export interface CommentCreated {
  id: string;
  created: string;
}

/** Group-scoped submit — caller passes the groupId explicitly. */
export type SubmitGroupCommentFn = (
  groupId: string,
  markdown: string,
  mentions: MentionMapping[],
  parentId?: string,
) => Promise<CommentCreated>;

/** Pre-bound submit — group id already captured by the caller. */
export type SubmitCommentFn = (
  markdown: string,
  mentions: MentionMapping[],
  parentId?: string,
) => Promise<CommentCreated>;

export type SearchJiraUsersFn = (query: string) => Promise<JiraUserSuggestion[]>;

export type RefreshGroupStatusFn = (groupId: string) => void;

/** Bundle for surfaces that render a specific group's comment thread. */
export interface GroupCommentCallbacks {
  onSubmitComment: SubmitGroupCommentFn;
  onSearchUsers?: SearchJiraUsersFn;
  onRefreshStatus?: RefreshGroupStatusFn;
}

export interface JiraCommentEditorProps {
  onSubmit: (markdown: string, mentions: MentionMapping[]) => void;
  onCancel?: () => void;
  onSearchUsers?: SearchJiraUsersFn;
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
  onSubmitComment: SubmitCommentFn;
  onSearchUsers?: SearchJiraUsersFn;
  onRefreshPoll: () => void;
}
