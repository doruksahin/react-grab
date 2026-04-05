import type { Component } from "solid-js";

interface EmptyStateProps {
  message: string;
  submessage?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
      <p class="text-sm text-white/60">{props.message}</p>
      {props.submessage && (
        <p class="text-xs text-white/40 mt-1">{props.submessage}</p>
      )}
      {props.action && (
        <button
          class="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-md cursor-pointer"
          onClick={props.action.onClick}
        >
          {props.action.label}
        </button>
      )}
    </div>
  );
};
