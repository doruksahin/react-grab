import { type Component, createSignal } from "solid-js";
import { Alert } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { IconAlertCircle } from "../icons/icon-alert-circle.js";

interface SyncOfflineBannerProps {
  onRetry?: () => Promise<void>;
}

/** Shown while the sync server cannot be reached; the list below stays usable. */
export const SyncOfflineBanner: Component<SyncOfflineBannerProps> = (props) => {
  const [isRetrying, setIsRetrying] = createSignal(false);

  const handleRetry = async () => {
    if (!props.onRetry) return;
    setIsRetrying(true);
    try {
      await props.onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Alert data-react-grab-sync-offline-banner class="mx-4 mt-3 shrink-0">
      <IconAlertCircle class="mt-0.5 shrink-0" />
      <div class="flex flex-col items-start gap-2">
        <span>
          Offline · your changes are kept on this device and sent when the
          server is back.
        </span>
        <Button
          data-react-grab-sync-retry
          variant="outline"
          size="sm"
          disabled={!props.onRetry || isRetrying()}
          onClick={() => {
            handleRetry().catch(() => {});
          }}
        >
          {isRetrying() ? "Retrying…" : "Retry"}
        </Button>
      </div>
    </Alert>
  );
};
