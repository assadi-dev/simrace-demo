import type { ReactNode } from "react"

/** Titre de page (maquettes) : h1 et resume a gauche ; source des donnees et actions a droite. */
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
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-page-title">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {eyebrow || actions ? (
        <div className="flex flex-wrap items-center gap-3">
          {eyebrow ? (
            <p className="text-eyebrow text-primary-text">{eyebrow}</p>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
