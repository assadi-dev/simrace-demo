import { createRootRoute, Outlet } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"

import { AppHeader } from "@/components/app-header"
import { useLiveStream } from "@/hooks/use-live-stream"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  // Un seul EventSource pour toute l'application.
  useLiveStream()

  return (
    <NuqsAdapter>
      <div className="flex min-h-svh flex-col gap-5 p-4 sm:p-6">
        <AppHeader />
        <main className="flex flex-1 flex-col gap-5">
          <Outlet />
        </main>
      </div>
    </NuqsAdapter>
  )
}
