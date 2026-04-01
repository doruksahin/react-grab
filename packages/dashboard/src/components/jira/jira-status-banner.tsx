import { useGetJiraTicketStatus } from "@/api/endpoints/jira/jira";
import { WORKSPACE_ID } from "@/lib/config";

interface JiraStatusBannerProps {
  groupId: string;
  jiraTicketId: string;
  jiraBaseUrl?: string;
}

const TIMELINE_STEPS = ["Created", "To Do", "In Progress", "Done"] as const;

function getStepIndex(status: string): number {
  if (status === "Done") return 3;
  if (status === "In Progress") return 2;
  if (status === "To Do") return 1;
  return 1; // default to "To Do" for unknown statuses
}

export function JiraStatusBanner({
  groupId,
  jiraTicketId,
  jiraBaseUrl = "https://appier.atlassian.net",
}: JiraStatusBannerProps) {
  const { data: statusData } = useGetJiraTicketStatus(WORKSPACE_ID, groupId, {
    query: { refetchInterval: 30000 }, // poll every 30s
  });

  const status =
    statusData?.status === 200 ? statusData.data.status : "To Do";
  const isDone = status === "Done";
  const currentStep = getStepIndex(status);

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div
        className={`flex items-center gap-3 p-4 rounded-lg border ${
          isDone
            ? "bg-green-500/10 border-green-500/20"
            : "bg-yellow-500/10 border-yellow-500/20"
        }`}
      >
        <span className="text-xl">{isDone ? "✅" : "🎣"}</span>
        <div className="flex-1">
          <div
            className={`font-semibold text-sm ${isDone ? "text-green-500" : "text-yellow-500"}`}
          >
            {jiraTicketId}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Status: {status}
          </div>
        </div>
        <a
          href={`${jiraBaseUrl}/browse/${jiraTicketId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          Open in JIRA ↗
        </a>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-0">
        {TIMELINE_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 ${
                  i < currentStep
                    ? "bg-green-500 border-green-500"
                    : i === currentStep
                      ? "bg-yellow-500 border-yellow-500"
                      : "border-border"
                }`}
              />
              <span className="text-[10px] text-muted-foreground">{step}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 -mt-4 ${
                  i < currentStep ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {isDone && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="text-sm text-green-500 font-medium">
            All selections resolved
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Feedback loop closed.
          </div>
        </div>
      )}
    </div>
  );
}
