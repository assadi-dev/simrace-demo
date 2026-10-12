import { expect, test } from "@playwright/test"

/*
 * Page Live (maquettes 5, 6 et 7). Postes et telemetrie sont des donnees de demo au format du
 * serveur (features/live/mock.ts) ; sans MediaMTX configure, chaque lecteur montre son affiche.
 */

test("la mosaique montre un lecteur par poste avec son statut", async ({
  page,
}) => {
  await page.goto("/live")

  await expect(
    page.getByRole("heading", { name: "Live", level: 1 })
  ).toBeVisible()
  await expect(page.getByText("Données de démo")).toBeVisible()
  await expect(page.getByRole("link", { name: "Voir en grand" })).toHaveCount(
    15
  )

  const offline = page.locator('[data-slot="card"]', { hasText: "sim-4 ·" })
  await expect(offline.getByText("Hors ligne", { exact: true })).toBeVisible()
  await expect(
    offline.getByText("Flux indisponible : poste hors ligne")
  ).toBeVisible()
  await expect(offline.getByText("Télémétrie n.d.")).toBeVisible()

  const paused = page.locator('[data-slot="card"]', { hasText: "sim-3 ·" })
  await expect(paused.getByText("Session en pause, image figée")).toBeVisible()
  await expect(page.getByText("WebRTC · image de démo").first()).toBeVisible()
})

test("la vue en grand puis le plein ecran, Echap revient a la vue en grand", async ({
  page,
}) => {
  await page.goto("/live")
  await page
    .locator('[data-slot="card"]', { hasText: "sim-1 ·" })
    .getByRole("link", { name: "Voir en grand" })
    .click()

  await expect(page).toHaveURL(/\/live\/sim-1$/)
  await expect(
    page.getByRole("heading", { name: "Alice Martin · sim-1", level: 1 })
  ).toBeVisible()
  await expect(page.getByText("Meilleur tour")).toBeVisible()

  await page.getByRole("link", { name: "Plein écran" }).click()
  const dialog = page.getByRole("dialog", { name: "Plein écran sim-1" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("km/h")).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/live\/sim-1$/)
  await expect(dialog).toBeHidden()
})
