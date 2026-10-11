import type { z } from "zod"

import { apiErrorBodySchema } from "@/contracts/errors"
import { stationListSchema } from "@/contracts/stations"

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

/**
 * Echec d'un appel au serveur. `code` vaut le nom d'erreur du serveur, ou `NetworkError`
 * (serveur injoignable) ou `ContractViolation` (reponse hors contrat Zod).
 */
export class ApiError extends Error {
  status: number | null
  code: string

  constructor(
    status: number | null,
    code: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      signal,
      headers: { Accept: "application/json" },
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new ApiError(null, "NetworkError", "Serveur injoignable", { cause })
  }

  if (!response.ok) {
    const body = apiErrorBodySchema.safeParse(
      await response.json().catch(() => null)
    )
    throw new ApiError(
      response.status,
      body.success ? body.data.error : "HttpError",
      (body.success && body.data.detail) || response.statusText
    )
  }

  // Le serveur ne fait pas confiance a l'agent ; le front ne fait pas confiance au serveur.
  const result = schema.safeParse(await response.json())
  if (!result.success) {
    throw new ApiError(
      response.status,
      "ContractViolation",
      `Reponse de ${path} hors contrat`,
      { cause: result.error }
    )
  }
  return result.data
}

export const fetchStations = (signal?: AbortSignal) =>
  getJson("/stations", stationListSchema, signal)
