import { useParams, Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGroupsWithComments } from "@/hooks/use-groups-with-comments";
import { ScreenshotImage } from "@/components/shared/screenshot-image";

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data: groups, isLoading } = useGroupsWithComments();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  const group = groups?.find((g) => g.id === groupId);
  if (!group) return <div className="text-muted-foreground">Group not found</div>;

  return (
    <div className="max-w-4xl">
      {/* Back + header */}
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Back to groups
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.comments.length} selection{group.comments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Comment cards */}
      <div className="space-y-4">
        {group.comments.map((comment) => {
          const sourceMatch = comment.content.match(/at \/(.+?)\)/);
          const source = sourceMatch?.[1];

          return (
            <Card key={comment.id}>
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-purple-400">
                    {comment.componentName ?? comment.elementName}
                  </span>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    &lt;{comment.tagName}&gt;
                  </Badge>
                </div>

                {/* Comment text */}
                {comment.commentText && (
                  <p className="text-sm text-muted-foreground italic">
                    "{comment.commentText}"
                  </p>
                )}

                {/* Screenshots */}
                {(comment.screenshotFullPage || comment.screenshotElement) && (
                  <div className="grid grid-cols-2 gap-3">
                    {comment.screenshotFullPage && (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <ScreenshotImage
                          screenshotKey={comment.screenshotFullPage}
                          alt="Full page"
                          className="w-full h-48 object-cover object-top"
                        />
                        <div className="text-[11px] text-muted-foreground px-3 py-1.5 border-t border-border">
                          Full page
                        </div>
                      </div>
                    )}
                    {comment.screenshotElement && (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <ScreenshotImage
                          screenshotKey={comment.screenshotElement}
                          alt="Element"
                          className="w-full h-48 object-contain bg-black/5"
                        />
                        <div className="text-[11px] text-muted-foreground px-3 py-1.5 border-t border-border">
                          Element
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Component context */}
                <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Selector</span>
                  <span className="font-mono text-muted-foreground">{comment.elementSelectors?.[0] ?? "—"}</span>
                  {source && (
                    <>
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-mono text-muted-foreground">{source}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="font-mono text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</span>
                </div>

                {/* Collapsible raw content */}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">Raw content</summary>
                  <pre className="mt-2 p-3 bg-muted/50 rounded-md overflow-x-auto text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                    {comment.content}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
