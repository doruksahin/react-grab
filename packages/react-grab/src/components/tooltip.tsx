// Re-export shadcn-solid Tooltip primitives for use throughout the app.
// The portal auto-mounts inside the shadow DOM via the module-level mount singleton.
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip.js";
