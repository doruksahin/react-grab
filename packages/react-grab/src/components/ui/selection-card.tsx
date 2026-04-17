import { type Component, type JSX, splitProps } from 'solid-js';
import { cn } from '../../utils/cn.js';

export interface SelectionCardProps {
  flagged?: boolean;
  selected?: boolean;
  class?: string;
  children: JSX.Element;
}

export const SelectionCard: Component<SelectionCardProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'flagged',
    'selected',
    'class',
    'children',
  ]);

  return (
    <div
      data-react-grab-selection-card
      class={cn(
        'bg-black/25 border border-foreground/[0.08] rounded-lg px-4 py-3 cursor-pointer transition-colors',
        'hover:border-foreground/[0.15] hover:bg-black/35',
        local.class
      )}
      classList={{
        'border-l-[3px] border-l-red-400 pl-[13px]': local.flagged === true,
        'bg-purple-400/[0.03] border-l-[3px] border-l-purple-400 pl-[13px]':
          local.selected === true && !local.flagged,
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
};
