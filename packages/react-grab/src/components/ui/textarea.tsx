import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const textareaVariants = cva({
  base: "m-0 resize-none wrap-break-word [field-sizing:content] [scrollbar-width:none] text-popover-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50",
  variants: {
    variant: {
      inline:
        "min-h-4 flex-1 overflow-y-auto border-none bg-transparent p-0 text-body leading-4 font-medium",
      field:
        "min-h-16 w-full overflow-y-auto rounded-lg border border-input bg-muted px-3 py-2.5 text-body leading-5 transition-colors focus:border-ring",
    },
  },
  defaultVariants: {
    variant: "inline",
  },
});

interface TextareaProps
  extends ComponentProps<"textarea">, VariantProps<typeof textareaVariants> {}

const Textarea: Component<TextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <textarea
      class={cn(textareaVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
};

export { Textarea, textareaVariants };
export type { TextareaProps };
