import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PROTOCOL_LABEL, PROTOCOLS, type Protocol } from "@/features/live/media"
import { useProtocol } from "@/features/live/use-protocol"

/** WebRTC par defaut (latence < 1 s), HLS en secours sur un reseau filtre. Choix dans l'URL. */
export function ProtocolToggle() {
  const [protocol, setProtocol] = useProtocol()
  return (
    <ToggleGroup
      type="single"
      aria-label="Protocole vidéo"
      value={protocol}
      onValueChange={(value) => value && void setProtocol(value as Protocol)}
    >
      {PROTOCOLS.map((p) => (
        <ToggleGroupItem key={p} value={p} className="text-sm">
          {PROTOCOL_LABEL[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
