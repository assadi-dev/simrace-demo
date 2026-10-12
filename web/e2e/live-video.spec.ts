import { expect, test, type Page } from "@playwright/test"

import { FakeAgent, uniqueId } from "./agent.ts"

/*
 * Page Live (maquettes 5, 6 et 7), branchee sur le vrai serveur : un faux agent envoie des lots,
 * la mosaique les montre. Pas de MediaMTX en test (VITE_MEDIA_HOST vide) : chaque carte dit
 * que le serveur video n'est pas configure, jamais une image inventee.
 */

/** Ouvre la mosaique et attend le flux : la telemetrie d'un poste n'arrive que par /stream. */
async function openMosaic(page: Page) {
  await page.goto("/live")
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
}

test("la mosaique montre un poste qui envoie des lots, avec sa telemetrie", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Alice Martin",
    machine: "PC-SIM-01",
  })
  await agent.sendBatch()
  await openMosaic(page)
  await agent.sendBatch({ speed_kmh: 186.9, completed_laps: 1 })

  await expect(
    page.getByRole("heading", { name: "Live", level: 1 })
  ).toBeVisible()
  const tile = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(tile.getByText("Alice Martin")).toBeVisible()
  await expect(tile.getByText(`${stationId} · PC-SIM-01`)).toBeVisible()
  await expect(tile.getByText("En course", { exact: true })).toBeVisible()
  await expect(tile.getByText("187 km/h · Tour 2")).toBeVisible()
  await expect(
    tile.getByText("Flux indisponible : serveur vidéo non configuré")
  ).toBeVisible()
  await expect(
    tile.getByRole("link", { name: `Voir en grand ${stationId}` })
  ).toBeVisible()
})

test("un poste en pause est signale sur sa carte", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "spa",
    driver: "Chloé Durand",
  })
  await agent.sendBatch()
  await openMosaic(page)
  await agent.sendBatch({ status: 3, speed_kmh: 0 })

  const tile = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(tile.getByText("En pause")).toBeVisible()
  await expect(tile.getByText("0 km/h · Tour 1")).toBeVisible()
})

test("la vue en grand puis le plein ecran, Echap revient a la vue en grand", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "nurburgring",
    driver: "Bruno Lefèvre",
  })
  await agent.sendBatch()
  await openMosaic(page)
  await agent.sendBatch({ best_lap_ms: 114_812, last_lap_ms: 114_812 })

  await page
    .locator('[data-slot="card"]', { hasText: stationId })
    .getByRole("link", { name: `Voir en grand ${stationId}` })
    .click()

  await expect(page).toHaveURL(new RegExp(`/live/${stationId}$`))
  await expect(
    page.getByRole("heading", {
      name: `Bruno Lefèvre · ${stationId}`,
      level: 1,
    })
  ).toBeVisible()
  await expect(page.getByText("1:54,812").first()).toBeVisible()

  // commandes du lecteur : invisibles, puis en fondu au survol de la video
  const controls = page.locator('[data-slot="video-controls"]')
  const fullscreenControl = controls.getByRole("link", { name: "Plein écran" })
  await page.mouse.move(0, 0)
  await expect(controls).toHaveCSS("opacity", "0")
  // le cadre du lecteur (sans MediaMTX en test, la video est sous l'etat "indisponible")
  await controls.locator("..").hover()
  await expect(controls).toHaveCSS("opacity", "1")
  await expect(controls.getByText("Direct", { exact: true })).toBeVisible()
  // info-bulle au survol d'une commande
  await fullscreenControl.hover()
  await expect(page.getByRole("tooltip", { name: "Plein écran" })).toBeVisible()
  await fullscreenControl.click()
  const dialog = page.getByRole("dialog", { name: `Plein écran ${stationId}` })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("km/h")).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(new RegExp(`/live/${stationId}$`))
  await expect(dialog).toBeHidden()
})

test("un poste inconnu le dit, sans inventer de valeurs", async ({ page }) => {
  await page.goto("/live/inconnu-e2e")
  await expect(page.getByText("Poste inconnu", { exact: true })).toBeVisible()
})
