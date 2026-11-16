import type { JiraPort, StorageAdapter } from "react-grab/sync-http";
import { pageRequestMessenger } from "../messaging/page-messengers.js";

export const createMessagingStorageAdapter = (): StorageAdapter => ({
  loadComments: () =>
    pageRequestMessenger.sendMessage("storage.loadComments", []),
  upsertComment: (...args) =>
    pageRequestMessenger.sendMessage("storage.upsertComment", args),
  deleteComment: (...args) =>
    pageRequestMessenger.sendMessage("storage.deleteComment", args),
  loadGroups: () => pageRequestMessenger.sendMessage("storage.loadGroups", []),
  upsertGroup: (...args) =>
    pageRequestMessenger.sendMessage("storage.upsertGroup", args),
  deleteGroup: (...args) =>
    pageRequestMessenger.sendMessage("storage.deleteGroup", args),
  archiveGroup: (...args) =>
    pageRequestMessenger.sendMessage("storage.archiveGroup", args),
  restoreGroup: (...args) =>
    pageRequestMessenger.sendMessage("storage.restoreGroup", args),
  uploadScreenshot: (...args) =>
    pageRequestMessenger.sendMessage("storage.uploadScreenshot", args),
  loadScreenshot: (...args) =>
    pageRequestMessenger.sendMessage("storage.loadScreenshot", args),
  uploadRecording: (...args) =>
    pageRequestMessenger.sendMessage("storage.uploadRecording", args),
});

export const createMessagingJiraPort = (): JiraPort => ({
  getDestination: () =>
    pageRequestMessenger.sendMessage("jira.getDestination", []),
  listIssueTypes: (...args) =>
    pageRequestMessenger.sendMessage("jira.listIssueTypes", args),
  listPriorities: () =>
    pageRequestMessenger.sendMessage("jira.listPriorities", []),
  listLabels: (...args) =>
    pageRequestMessenger.sendMessage("jira.listLabels", args),
  getTicketStatus: (...args) =>
    pageRequestMessenger.sendMessage("jira.getTicketStatus", args),
  createTicket: (...args) =>
    pageRequestMessenger.sendMessage("jira.createTicket", args),
  addComment: (...args) =>
    pageRequestMessenger.sendMessage("jira.addComment", args),
  searchUsers: (...args) =>
    pageRequestMessenger.sendMessage("jira.searchUsers", args),
});
