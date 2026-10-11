import { z } from "zod"

/* Corps d'erreur du serveur : { "error": "<NomDeLErreur>", "detail": "..." } (404, 422). */
export const apiErrorBodySchema = z.object({
  error: z.string(),
  detail: z.string().nullish(),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
