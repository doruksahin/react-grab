import { type Component, For } from "solid-js";
import { getStatusColor } from "../../features/sidebar/status-colors.js";

interface StatusLegendProps {
  onClose: () => void;
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  "No Task": "Selection group not yet linked to a JIRA ticket",
  "To Do": "Ticket created, not yet started",
  "In Progress": "Developer actively working on it",
  "Code Review": "Pull request submitted for review",
  "Test": "QA testing in progress",
  "Test Passed": "QA approved, ready for UAT",
  "UAT": "User acceptance testing",
  "In Preprod": "Deployed to pre-production environment",
  "In Production": "Live in production",
  "Won't Do": "Ticket closed without implementation",
  "Done": "Completed and verified",
};

const FLOW = ["No Task", "To Do", "In Progress", "Code Review", "Test", "Test Passed", "UAT", "In Preprod", "In Production", "Done"];

export const StatusLegend: Component<StatusLegendProps> = (props) => {
  return (
    <div class="absolute inset-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-sm flex flex-col overflow-y-auto">
      <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span class="text-[13px] font-semibold text-white">Status Legend</span>
        <button
          class="text-[11px] text-white/60 hover:text-white cursor-pointer"
          onClick={props.onClose}
        >
          Got it
        </button>
      </div>
      <div class="px-4 py-3 space-y-2">
        <For each={FLOW}>
          {(status) => {
            const color = status === "No Task"
              ? getStatusColor(undefined)
              : getStatusColor(status);
            return (
              <div class="flex items-start gap-2.5">
                <div
                  class="w-3 h-3 rounded-sm mt-0.5 shrink-0"
                  style={{ background: color.hex }}
                />
                <div>
                  <div class="text-[11px] font-medium text-white/90">{status}</div>
                  <div class="text-[10px] text-white/50">{STATUS_DESCRIPTIONS[status]}</div>
                </div>
              </div>
            );
          }}
        </For>
        <div class="mt-3 pt-3 border-t border-white/10">
          <div class="text-[10px] text-white/40 leading-relaxed">
            Lifecycle: No Task → To Do → In Progress → Code Review → Test → Test Passed → UAT → In Preprod → In Production → Done
          </div>
        </div>
      </div>
    </div>
  );
};
