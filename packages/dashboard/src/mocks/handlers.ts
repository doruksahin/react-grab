// Collect all Orval-generated MSW handlers into a single array
import { getCommentsMock } from "../api/endpoints/comments/comments.msw";
import { getGroupsMock } from "../api/endpoints/groups/groups.msw";
import { getHealthMock } from "../api/endpoints/health/health.msw";

export const handlers = [
  ...getCommentsMock(),
  ...getGroupsMock(),
  ...getHealthMock(),
];
