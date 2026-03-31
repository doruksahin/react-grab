// Re-export all Orval-generated MSW handlers
import { getSelectionsMock } from "../api/endpoints/selections/selections.msw";
import { getGroupsMock } from "../api/endpoints/groups/groups.msw";
import { getHealthMock } from "../api/endpoints/health/health.msw";

export const handlers = [
  ...getSelectionsMock(),
  ...getGroupsMock(),
  ...getHealthMock(),
];
