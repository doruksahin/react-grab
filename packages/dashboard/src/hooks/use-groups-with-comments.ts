import { useListGroups } from "@/api/endpoints/groups/groups";
import { useListComments } from "@/api/endpoints/comments/comments";
import { WORKSPACE_ID } from "@/lib/config";
import type { GroupWithComments } from "@/lib/types";

export function useGroupsWithComments() {
  const groups = useListGroups(WORKSPACE_ID);
  const comments = useListComments(WORKSPACE_ID);

  const isLoading = groups.isLoading || comments.isLoading;
  const error = groups.error || comments.error;

  const data: GroupWithComments[] | undefined =
    groups.data && comments.data
      ? groups.data.data.map((group) => ({
          ...group,
          comments: comments.data.data.filter((c) => c.groupId === group.id),
        }))
      : undefined;

  return { data, isLoading, error };
}
