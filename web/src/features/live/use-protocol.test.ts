import { describe, expect, it } from "vitest"

import { protocolParser } from "@/features/live/use-protocol"

describe("protocole video dans l'URL", () => {
  it("lit webrtc et hls", () => {
    expect(protocolParser.parse("hls")).toBe("hls")
    expect(protocolParser.parse("webrtc")).toBe("webrtc")
  })

  it("ignore une valeur inconnue (WebRTC par defaut)", () => {
    expect(protocolParser.parse("rtmp")).toBeNull()
    expect(protocolParser.defaultValue).toBe("webrtc")
  })
})
