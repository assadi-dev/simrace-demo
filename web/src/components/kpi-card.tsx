import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** KPI (design.md 8) : libelle, valeur en grand, aide en dessous. */
export function KpiCard({
  label,
  value,
  help,
  className,
}: {
  label: string
  value: string
  help: string
  className?: string
}) {
  return (
    <Card size="sm" className={cn("min-w-0 gap-2 px-5", className)}>
      <span className="text-label text-muted-foreground">{label}</span>
      <span className="text-metric">{value}</span>
      <span className="text-meta text-muted-foreground">{help}</span>
    </Card>
  )
}
