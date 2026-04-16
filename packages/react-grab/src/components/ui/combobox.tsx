import type {
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxItemProps,
  ComboboxTriggerProps,
} from '@kobalte/core/combobox';
import { Combobox as ComboboxPrimitive } from '@kobalte/core/combobox';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ParentProps, ValidComponent, VoidProps } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '../../utils/cn.js';

export const Combobox = ComboboxPrimitive;
export const ComboboxDescription = ComboboxPrimitive.Description;
export const ComboboxErrorMessage = ComboboxPrimitive.ErrorMessage;
export const ComboboxItemDescription = ComboboxPrimitive.ItemDescription;
export const ComboboxHiddenSelect = ComboboxPrimitive.HiddenSelect;

type comboboxInputProps<T extends ValidComponent = 'input'> = VoidProps<
  ComboboxInputProps<T> & {
    class?: string;
  }
>;

export const ComboboxInput = <T extends ValidComponent = 'input'>(
  props: PolymorphicProps<T, comboboxInputProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxInputProps, ['class']);

  return (
    <ComboboxPrimitive.Input
      class={cn(
        'h-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        local.class
      )}
      {...rest}
    />
  );
};

type comboboxTriggerProps<T extends ValidComponent = 'button'> = ParentProps<
  ComboboxTriggerProps<T> & {
    class?: string;
  }
>;

export const ComboboxTrigger = <T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, comboboxTriggerProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxTriggerProps, [
    'class',
    'children',
  ]);

  return (
    <ComboboxPrimitive.Control>
      <ComboboxPrimitive.Trigger
        class={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input px-3 shadow-sm',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <ComboboxPrimitive.Icon class="flex h-3.5 w-3.5 items-center justify-center">
          <svg
            viewBox="0 0 16 16"
            class="h-4 w-4 opacity-50"
          >
            <path fill="currentColor" d="m14.53 9.97-6-6a.75.75 0 0 0-1.004-.052l-.056.052-6 6 1.06 1.06L8 5.56l5.47 5.47z" />
            <path fill="currentColor" d="m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z" />
          </svg>
        </ComboboxPrimitive.Icon>
      </ComboboxPrimitive.Trigger>
    </ComboboxPrimitive.Control>
  );
};

type comboboxContentProps<T extends ValidComponent = 'div'> =
  ComboboxContentProps<T> & {
    class?: string;
  };

export const ComboboxContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, comboboxContentProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxContentProps, ['class']);

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Content
        class={cn(
          'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 origin-[--kb-combobox-content-transform-origin]',
          local.class
        )}
        {...rest}
      >
        <ComboboxPrimitive.Listbox class="p-1" />
      </ComboboxPrimitive.Content>
    </ComboboxPrimitive.Portal>
  );
};

type comboboxItemProps<T extends ValidComponent = 'li'> = ParentProps<
  ComboboxItemProps<T> & {
    class?: string;
  }
>;

export const ComboboxItem = <T extends ValidComponent = 'li'>(
  props: PolymorphicProps<T, comboboxItemProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxItemProps, [
    'class',
    'children',
  ]);

  return (
    <ComboboxPrimitive.Item
      class={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50',
        local.class
      )}
      {...rest}
    >
      <ComboboxPrimitive.ItemIndicator class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <svg
          viewBox="0 0 16 16"
          class="h-4 w-4"
        >
          <path fill="currentColor" d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z" />
        </svg>
      </ComboboxPrimitive.ItemIndicator>
      <ComboboxPrimitive.ItemLabel>
        {local.children}
      </ComboboxPrimitive.ItemLabel>
    </ComboboxPrimitive.Item>
  );
};
