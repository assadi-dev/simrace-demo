import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/*
 * Boutons SimRace (design.md 8) : toujours en pilule, 44px de haut (cible tactile).
 * `ink` = l'action principale, un seul par zone ; `secondary` = verre dense ; `ghost` = nav inactive.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-[15px] font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ink: "bg-ink text-ink-foreground hover:bg-ink/90",
        secondary:
          "border-card-border bg-secondary text-secondary-foreground hover:bg-white/80",
        outline:
          "border-border-strong bg-transparent text-foreground hover:bg-accent",
        ghost: "bg-transparent font-medium text-foreground hover:bg-accent",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        link: "rounded-none text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4.5",
        sm: "h-9 gap-1.5 px-3.5 text-sm",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    compoundVariants: [
      { variant: "link", class: "h-auto px-0 font-medium" },
    ],
    defaultVariants: {
      variant: "ink",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "ink",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
