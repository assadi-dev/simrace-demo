import { Volume2Icon, VolumeXIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PROTOCOL_LABEL, PROTOCOLS, type Protocol } from "@/features/live/media"
import { useLivePrefs } from "@/features/live/prefs-store"

/** WebRTC par defaut (latence < 1 s), HLS en secours sur un reseau filtre. */
export function ProtocolToggle() {
  const protocol = useLivePrefs((s) => s.protocol)
  const setProtocol = useLivePrefs((s) => s.setProtocol)
  return (
    <ToggleGroup
      type="single"
      aria-label="Protocole vidéo"
      value={protocol}
      onValueChange={(value) => value && setProtocol(value as Protocol)}
    >
      {PROTOCOLS.map((p) => (
        <ToggleGroupItem key={p} value={p} className="text-sm">
          {PROTOCOL_LABEL[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Son coupe ou active pour tous les lecteurs. */
export function MuteButton({ className }: { className?: string }) {
  const muted = useLivePrefs((s) => s.muted)
  const toggleMuted = useLivePrefs((s) => s.toggleMuted)
  return (
    <Button
      variant="secondary"
      aria-pressed={!muted}
      onClick={toggleMuted}
      className={className}
    >
      {muted ? (
        <VolumeXIcon aria-hidden="true" className="size-4.5" />
      ) : (
        <Volume2Icon aria-hidden="true" className="size-4.5" />
      )}
      {muted ? "Son coupé" : "Son activé"}
    </Button>
  )
}
