import type { ListComments200Item } from "@/api/model";
import type { ListGroups200Item } from "@/api/model";

export type Comment = ListComments200Item;
export type Group = ListGroups200Item;

/** Group with its comments joined client-side */
export interface GroupWithComments extends Group {
  comments: Comment[];
}
