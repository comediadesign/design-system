import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"
import { Slot } from "radix-ui"

// Email's badge family (components/Badge.tsx, Figma badge sheet 2409:4424):
// 10px bold caps on 4px corners, brand-palette pairings, rather than shadcn's
// rounded grey pills — so a badge in Outreach reads like one in the inbox.
//   default     → Needs reply (Blue 00 / Rose 00): replied, the ball is yours
//   secondary   → Draft (Yellow 00 / Dark Grey): drafts and ready to send
//   destructive → Needs you (chip / Rose 00): stuck, restricted, missing
//   outline     → a quiet chip (chip / Light Grey): neutral labels
//   awaiting    → Awaiting (Green 00 / White Hover): sent, the ball is theirs
//   agent       → the agent is on it (chip / Light Blue)
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-[2px] overflow-hidden rounded-[4px] border-0 px-[8px] py-[2px] text-[10px] font-bold uppercase leading-normal whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-[#001882] text-[var(--color-rose)] [a&]:hover:opacity-90",
        secondary: "bg-[var(--color-yellow-00)] text-[#0C0C0C] [a&]:hover:opacity-90",
        destructive: "bg-[var(--color-chip)] text-[var(--color-rose)] [a&]:hover:opacity-90",
        outline: "bg-[var(--color-chip)] text-[var(--color-text-mid)] [a&]:hover:text-[var(--color-text-hi)]",
        awaiting: "bg-[#035525] text-[#ECEEE7]",
        agent: "bg-[var(--color-chip)] text-[#B9D6DF]",
        ghost: "text-[var(--color-text-mid)] [a&]:hover:bg-sc-accent",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
