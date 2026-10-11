import type { ReactNode } from "react"

/** Titre de page : surtitre (source des donnees), h1, description, actions a droite. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <p className="text-eyebrow text-primary-text">{eyebrow}</p>
        ) : null}
        <h1 className="text-page-title">{title}</h1>
        {description ? (
          <p className="text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
