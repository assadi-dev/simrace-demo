import { Link } from "@tanstack/react-router"
import { RadioIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLiveStore, type Connection } from "@/stores/live-store"

const FLOW = {
  connected: { status: "online", label: "Flux en direct connecté" },
  connecting: { status: "paused", label: "Connexion au flux" },
  reconnecting: { status: "paused", label: "Reconnexion du flux" },
  offline: { status: "offline", label: "Flux hors ligne" },
} as const satisfies Record<
  Connection,
  { status: "online" | "paused" | "offline"; label: string }
>

function NavLink({ to, label }: { to: "/" | "/leaderboard"; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "data-[status=active]:bg-ink data-[status=active]:font-semibold data-[status=active]:text-ink-foreground"
      )}
    >
      {label}
    </Link>
  )
}

/** En-tête : marque, navigation en pilules (l'active en `ink`), état du flux SSE. */
export function AppHeader() {
  const connection = useLiveStore((state) => state.connection)
  const flow = FLOW[connection]

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-card-border bg-card px-6 py-4">
      <Link to="/" className="flex flex-col rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="text-brand">SimRace</span>
        <span className="text-caption text-muted-foreground">
          Centre de simulation · démo
        </span>
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-wrap gap-1">
        <NavLink to="/" label="Postes" />
        <NavLink to="/leaderboard" label="Leaderboard" />
      </nav>
      <div
        role="status"
        aria-live="polite"
        className="ml-auto flex items-center gap-2"
      >
        <RadioIcon aria-hidden="true" className="size-4 text-primary-text" />
        <StatusBadge status={flow.status} label={flow.label} />
      </div>
    </header>
  )
}
