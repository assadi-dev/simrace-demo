import { queryOptions } from "@tanstack/react-query"

import { fetchTrackMap } from "@/lib/api"

/**
 * Nom de dossier du circuit cote serveur : miroir de Slug.from_untrusted (server/app/shared/slug.py).
 * Le serveur refuse (422) un nom qui n'est pas deja sous cette forme.
 */
export function trackSlug(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
  return cleaned.slice(0, 64).replace(/[_-]+$/, "")
}

/**
 * Carte de reference d'un circuit. Relue toutes les 60 s : un tour plus rapide peut la remplacer,
 * et un circuit sans carte en obtient une des que le serveur enregistre un tour valide.
 */
export const trackMapQueryOptions = (track: string) =>
  queryOptions({
    queryKey: ["tracks", trackSlug(track), "reference"],
    queryFn: ({ signal }) => fetchTrackMap(trackSlug(track), signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
