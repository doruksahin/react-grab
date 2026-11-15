import { Image as ImagePrimitive } from "@kobalte/core/image";
import { cva, type VariantProps } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import {
  avatarColor,
  initials,
} from "../../features/jira-comments/avatar-utils.js";
import { cn } from "../../utils/cn.js";

const avatarVariants = cva({
  base: "inline-flex shrink-0 overflow-hidden rounded-full select-none",
  variants: {
    size: {
      xs: "size-3.5 text-[6px]",
      sm: "size-4 text-[7px]",
      md: "size-5 text-[8px]",
      lg: "size-6 text-[10px]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface AvatarProps
  extends
    Omit<ComponentProps<"span">, "children">,
    VariantProps<typeof avatarVariants> {
  name: string | null | undefined;
  src?: string | null;
}

const Avatar: Component<AvatarProps> = (props) => {
  const [local, rest] = splitProps(props, ["name", "src", "size", "class"]);

  return (
    <ImagePrimitive
      data-react-grab-avatar
      class={cn(avatarVariants({ size: local.size }), local.class)}
      {...rest}
    >
      <ImagePrimitive.Img
        data-testid="user-avatar-img"
        src={local.src ?? undefined}
        alt={local.name ?? ""}
        class="size-full object-cover"
      />
      <ImagePrimitive.Fallback
        data-testid="user-avatar-initials"
        class="flex size-full items-center justify-center font-semibold leading-none text-white"
        style={{ background: avatarColor(local.name) }}
      >
        {initials(local.name)}
      </ImagePrimitive.Fallback>
    </ImagePrimitive>
  );
};

export { Avatar, avatarVariants };
export type { AvatarProps };
