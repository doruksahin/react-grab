import React, {
  StrictMode,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";

export interface FreezeContractProbe {
  update: (value: number) => void;
  incrementState: () => void;
  unmount: () => void;
  subscribers: () => number;
  ready: boolean;
}

declare global {
  interface Window {
    freezeContract: FreezeContractProbe;
  }
}

interface FreezeContractViewProps {
  identity: string;
}

interface FreezeContractSnapshot {
  count: number;
  optional: number | undefined;
}

const options = new URLSearchParams(location.search);
const subscribers = new Set<() => void>();
const stateUpdates = new Map<string, () => void>();
let snapshot: FreezeContractSnapshot = { count: 0, optional: undefined };
const subscribe = (onChange: () => void) => {
  subscribers.add(onChange);
  return () => subscribers.delete(onChange);
};
const getSnapshot = () => {
  if (options.get("scenario")?.startsWith("error") && snapshot.count === 1) {
    throw new Error("Snapshot temporarily unavailable");
  }
  return snapshot.count;
};

interface SnapshotBoundaryState {
  failed: boolean;
}

class SnapshotBoundary extends React.Component<
  React.PropsWithChildren<FreezeContractViewProps>,
  SnapshotBoundaryState
> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render = () =>
    this.state.failed
      ? React.createElement("output", { id: this.props.identity }, "ERROR")
      : this.props.children;
}

const View = (props: FreezeContractViewProps) => {
  const [count, setCount] = useState(0);
  const external = useSyncExternalStore(
    subscribe,
    options.get("getter") === "inline" ? () => getSnapshot() : getSnapshot,
  );
  const optional = useSyncExternalStore(subscribe, () => snapshot.optional);
  const object = useSyncExternalStore(subscribe, () => snapshot);
  useLayoutEffect(() => {
    if (!stateUpdates.has(props.identity)) {
      stateUpdates.set(props.identity, () =>
        setCount((previous) => previous + 1),
      );
    }
    window.freezeContract.ready = stateUpdates.size === roots.length;
  });
  return React.createElement(
    "output",
    { id: props.identity },
    JSON.stringify([count, external, optional ?? "undefined", object.count]),
  );
};

const roots = ["first", "second"].map((identity) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const view = React.createElement(
    SnapshotBoundary,
    { identity },
    React.createElement(View, { identity }),
  );
  root.render(
    options.get("strict") === "true"
      ? React.createElement(StrictMode, null, view)
      : view,
  );
  return root;
});

window.freezeContract = {
  ready: false,
  update: (value) => {
    snapshot = { count: value, optional: value };
    subscribers.forEach((onChange) => onChange());
  },
  incrementState: () => stateUpdates.forEach((update) => update()),
  subscribers: () => subscribers.size,
  unmount: () => roots.forEach((root) => root.unmount()),
};
