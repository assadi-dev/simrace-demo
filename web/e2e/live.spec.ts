import { expect, test } from "@playwright/test"

import { FakeAgent, uniqueId } from "./agent.ts"

/*
 * Scenario de demo : un agent envoie des lots, le front les montre.
 * Chaque test cree ses propres postes (identifiants uniques) pour ne pas dependre des autres.
 */

test("la page Postes montre un poste qui vient d'envoyer un lot", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Alice Martin",
  })
  await agent.sendBatch()

  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Postes", level: 1 })).toBeVisible()
  const card = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(card).toBeVisible()
  await expect(card.getByText("En ligne")).toBeVisible()
  await expect(card.getByText("Alice Martin")).toBeVisible()
})

test("l'indicateur du flux passe a connecte", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("status")).toContainText("Flux en direct connecté")
})

test("un poste en pause est signale comme tel", async ({ page, request }) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "spa",
    driver: "Chloé Durand",
  })
  await page.goto("/")
  await expect(page.getByRole("status")).toContainText("Flux en direct connecté")

  // le statut "pause" (3) ne vient que du flux : le poste doit d'abord y apparaitre
  await agent.sendBatch({ status: 3, speed_kmh: 0 })
  await agent.sendBatch({ status: 3, speed_kmh: 0 })

  const card = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(card.getByText("En pause")).toBeVisible()
})

test("l'ecran Direct affiche la vitesse recue par le flux", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Bruno Lefèvre",
  })
  await page.goto(`/stations/${stationId}`)
  await expect(page.getByText("Aucun échantillon reçu pour ce poste.")).toBeVisible()

  await agent.sendBatch({ speed_kmh: 213, gear: 5 })

  await expect(page.getByText("213")).toBeVisible()
  await expect(page.getByText(/rapport 5/)).toBeVisible()
})

test("le leaderboard classe les pilotes d'un circuit avec leurs temps en direct", async ({
  page,
  request,
}) => {
  const track = uniqueId("circuit")
  const leader = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote Premier",
  })
  const chaser = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote Second",
  })
  const common = { lap_time_ms: 41_000, last_lap_ms: 108_431, best_lap_ms: 107_900 }
  // un premier lot declare les postes (GET /stations) ; la page s'ouvre ensuite
  await leader.sendBatch()
  await chaser.sendBatch()
  await page.goto(`/leaderboard?circuit=${track}`)
  await expect(page.getByRole("status")).toContainText("Flux en direct connecté")

  // le flux ne rejoue pas l'historique : comme un vrai agent, on continue d'envoyer
  await leader.sendBatch({ ...common, completed_laps: 3, track_pos: 0.2 })
  await chaser.sendBatch({ ...common, completed_laps: 2, track_pos: 0.9 })

  const rows = page.getByRole("row")
  await expect(rows.nth(1)).toContainText("Pilote Premier")
  await expect(rows.nth(2)).toContainText("Pilote Second")
  // temps de tour au format m:ss,mmm
  await expect(rows.nth(1)).toContainText("1:48,431")
  await expect(rows.nth(1)).toContainText("1:47,900")
})

test("le circuit choisi sur le leaderboard vit dans l'URL", async ({ page, request }) => {
  // noms tries : "aaa" avant "zzz", donc "aaa" est le circuit affiche par defaut
  const early = `aaa-${uniqueId("c")}`
  const late = `zzz-${uniqueId("c")}`
  await new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track: early,
    driver: "Pilote Matin",
  }).sendBatch()
  await new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track: late,
    driver: "Pilote Soir",
  }).sendBatch()

  // un lien partage avec ?circuit= ouvre directement la bonne vue
  await page.goto(`/leaderboard?circuit=${late}`)
  await expect(page.getByRole("row", { name: /Pilote Soir/ })).toBeVisible()
  await expect(page.getByText("Pilote Matin")).toHaveCount(0)

  // et changer de circuit met a jour l'URL
  await page.getByRole("radio", { name: new RegExp(early) }).click()
  await expect(page).toHaveURL(new RegExp(`circuit=${early}`))
  await expect(page.getByRole("row", { name: /Pilote Matin/ })).toBeVisible()
  await expect(page.getByText("Pilote Soir")).toHaveCount(0)
})

test("trier les temps : le plus rapide d'abord, puis inverse, aria-sort a jour", async ({ page, request }) => {
  const track = uniqueId("circuit")
  const slow = new FakeAgent(request, { stationId: uniqueId("sim"), track, driver: "Pilote A" })
  const fast = new FakeAgent(request, { stationId: uniqueId("sim"), track, driver: "Pilote B" })
  // ce poste est declare mais ne repasse jamais par le flux : ses temps restent inconnus (n.d.)
  const silent = new FakeAgent(request, { stationId: uniqueId("sim"), track, driver: "Pilote C" })
  await slow.sendBatch()
  await fast.sendBatch()
  await silent.sendBatch()
  await page.goto(`/leaderboard?circuit=${track}`)
  await expect(page.getByRole("status")).toContainText("Flux en direct connecté")
  await slow.sendBatch({ best_lap_ms: 110_000 })
  await fast.sendBatch({ best_lap_ms: 105_000 })
  await expect(page.getByRole("row", { name: /Pilote B/ })).toContainText("1:45,000")

  const header = page.getByRole("columnheader", { name: "Meilleur tour" })
  await expect(header).not.toHaveAttribute("aria-sort", /.+/)

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "ascending")
  await expect(page.getByRole("row").nth(1)).toContainText("Pilote B")
  await expect(page.getByRole("row").nth(3)).toContainText("Pilote C")

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "descending")
  await expect(page.getByRole("row").nth(1)).toContainText("Pilote A")
  // un temps inconnu reste en bas quel que soit le sens du tri
  await expect(page.getByRole("row").nth(3)).toContainText("Pilote C")
})

test.describe("telephone (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("la page ne defile jamais horizontalement, meme avec beaucoup de circuits", async ({
    page,
    request,
  }) => {
    // 8 circuits aux noms longs : la barre de choix doit passer a la ligne, pas elargir la page
    for (let i = 0; i < 8; i++) {
      await new FakeAgent(request, {
        stationId: uniqueId("sim"),
        track: `circuit-${i}-${uniqueId("nom-de-circuit-long")}`,
        driver: `Pilote ${i}`,
      }).sendBatch()
    }

    for (const path of ["/", "/leaderboard"]) {
      await page.goto(path)
      await expect(page.getByRole("status")).toContainText("Flux en direct connecté")
      // scrollWidth > clientWidth sur <html> = la page deborde du telephone
      const { scrollWidth, clientWidth } = await page
        .locator("html")
        .evaluate((html) => ({
          scrollWidth: html.scrollWidth,
          clientWidth: html.clientWidth,
        }))
      expect(scrollWidth, `debordement horizontal sur ${path}`).toBeLessThanOrEqual(
        clientWidth
      )
    }
  })
})
