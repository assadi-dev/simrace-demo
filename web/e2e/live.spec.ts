import { expect, test } from "@playwright/test"

import { FakeAgent, uniqueId } from "./agent.ts"
import { API_URL } from "./env.ts"

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

  await expect(
    page.getByRole("heading", { name: "Postes", level: 1 })
  ).toBeVisible()
  const card = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(card).toBeVisible()
  await expect(card.getByText("En ligne")).toBeVisible()
  await expect(card.getByText("Alice Martin")).toBeVisible()
})

test("la carte d'un poste montre le meilleur tour d'ACC et les temperatures", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Pilote Meteo",
  })
  await agent.sendBatch()
  await page.goto("/")
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )

  await agent.sendBatch({
    best_lap_ms: 129_402,
    air_temp_c: 27.1,
    road_temp_c: 27.9,
  })

  const card = page.locator('[data-slot="card"]', { hasText: stationId })
  await expect(card).toContainText("2:09,402")
  await expect(card).toContainText(/Air\s*27,1\s°C/)
  await expect(card).toContainText(/Piste\s*27,9\s°C/)
})

test("l'indicateur du flux passe a connecte", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
})

test("un poste en pause est signale comme tel", async ({ page, request }) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "spa",
    driver: "Chloé Durand",
  })
  await page.goto("/")
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )

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
  await expect(
    page.getByText("Aucun échantillon reçu pour ce poste.")
  ).toBeVisible()

  await agent.sendBatch({ speed_kmh: 213, gear: 5, rpm: 7200 })

  await expect(
    page.getByRole("heading", { name: `${stationId} · monza`, level: 1 })
  ).toBeVisible()
  await expect(
    page.getByRole("img", { name: /213 km\/h, 7200 tours/ })
  ).toBeVisible()
  const gear = page
    .getByRole("term")
    .filter({ hasText: "Rapport" })
    .locator("..")
  await expect(gear).toContainText("5")
  // reglages non envoyes par ce faux agent : affiches n.d., jamais inventes
  await expect(page.getByText("n.d. · n.d.")).toBeVisible()
})

test("l'ecran Direct deduit les tours et suit un drapeau jaune", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "spa",
    driver: "Chloé Durand",
  })
  await page.goto(`/stations/${stationId}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )

  // le flux ne rejoue pas le passe : la page est ouverte avant que le tour se termine
  await agent.sendBatch({
    completed_laps: 0,
    is_valid_lap: true,
    track_flags: ["green"],
  })
  // ACC retient ce tour comme meilleur temps : il est liste tout de suite
  await agent.sendBatch({
    completed_laps: 1,
    last_lap_ms: 108_431,
    best_lap_ms: 108_431,
    lap_time_ms: 2_460,
  })

  const laps = page.getByRole("table").filter({ hasText: "Validité" })
  await expect(laps.getByRole("row").nth(1)).toContainText("2 (en cours)")
  await expect(laps.getByRole("row").nth(2)).toContainText("1:48,431")
  await expect(laps.getByRole("row").nth(2)).toContainText("Meilleur")
  await expect(laps.getByRole("row").nth(2)).toContainText("Valide")

  // virage coupe : is_valid_lap faux un instant puis remis a vrai avant la ligne
  const best = { best_lap_ms: 108_431, is_valid_lap: true }
  await agent.sendBatch({ ...best, completed_laps: 1, is_valid_lap: false })
  await agent.sendBatch({ ...best, completed_laps: 1, is_valid_lap: true })
  await agent.sendBatch({ ...best, completed_laps: 2, last_lap_ms: 100_000 })
  await expect(laps.getByRole("row").nth(1)).toContainText("3 (en cours)")
  await expect(laps.getByRole("row")).toHaveCount(3)
  await expect(page.getByText(/invalidés par ACC 1/)).toBeVisible()

  // tour declare valide mais plus rapide que le meilleur retenu par ACC (2 s apres la ligne)
  await agent.sendBatch({ ...best, completed_laps: 3, last_lap_ms: 99_000 })
  await agent.sendBatch({ ...best, completed_laps: 3 }, 130) // 130 x 17 ms > 2 s
  await expect(
    page.getByText(/plus rapides que le meilleur d'ACC 1/)
  ).toBeVisible()
  await expect(laps.getByRole("row")).toHaveCount(3)
  await expect(laps).not.toContainText("1:39,000")

  await agent.sendBatch({
    completed_laps: 3,
    track_flags: ["green", "yellow", "yellow_s2"],
  })

  const current = page.getByRole("list", { name: "État actuel" })
  await expect(current).toContainText("Drapeau jaune secteur 2")
  const events = page
    .getByRole("table")
    .filter({ hasText: "Temps correspondant" })
  await expect(events.getByRole("row").nth(1)).toContainText(
    "Drapeau jaune secteur 2"
  )
  await expect(events.getByRole("row").nth(1)).toContainText("En cours")

  await agent.sendBatch({ completed_laps: 3, track_flags: ["green"] })
  await expect(events.getByRole("row").nth(1)).toContainText("Levé")
  await expect(current).not.toContainText("jaune")
})

test("les courbes se dessinent, la fenetre vit dans l'URL et se fige", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Pilote Courbe",
  })
  await page.goto(`/stations/${stationId}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
  await agent.sendBatch({ speed_kmh: 150 }, 20)

  const speed = page.getByRole("img", { name: /Courbe de vitesse/ })
  await expect(speed).toHaveAccessibleName(/sur les 30 dernières secondes/)
  await expect(speed).not.toHaveAttribute("data-points", "0")
  await expect(speed.locator("canvas")).toBeVisible()

  await page.getByRole("radio", { name: "10 s" }).click()
  await expect(page).toHaveURL(/fenetre=10/)
  await expect(speed).toHaveAccessibleName(/sur les 10 dernières secondes/)

  // fige : de nouveaux echantillons n'ajoutent plus de points dessines
  const freeze = page.getByRole("button", { name: "Figer les courbes" })
  await freeze.click()
  await expect(
    page.getByRole("button", { name: "Reprendre le direct" })
  ).toHaveAttribute("aria-pressed", "true")
  const frozenPoints = await speed.getAttribute("data-points")
  await agent.sendBatch({ speed_kmh: 160 }, 20)
  await page.waitForTimeout(300)
  await expect(speed).toHaveAttribute("data-points", frozenPoints ?? "")
})

test("la distance et la vitesse moyenne se remettent a zero", async ({
  page,
  request,
}) => {
  const stationId = uniqueId("sim")
  const agent = new FakeAgent(request, {
    stationId,
    track: "monza",
    driver: "Pilote Zero",
  })
  await page.goto(`/stations/${stationId}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
  await agent.sendBatch({ speed_kmh: 180 }, 30)

  const average = page
    .getByRole("term")
    .filter({ hasText: "Vitesse moyenne" })
    .locator("..")
  await expect(average).toContainText("180")
  await page.getByRole("button", { name: /Remettre à zéro/ }).click()
  await expect(average).toContainText("n.d.")
  await expect(
    page.getByRole("button", { name: /Remettre à zéro/ })
  ).toBeDisabled()
})

/** Un tour complet sur un ovale de 300 x 150 m, comme l'enverrait l'agent (x, z en metres). */
const oval = (pos: number) => ({
  x: 300 * Math.cos(2 * Math.PI * pos),
  z: 150 * Math.sin(2 * Math.PI * pos),
})

test("la vraie carte du circuit montre la trace, d'une autre couleur hors piste", async ({
  page,
  request,
}) => {
  const track = uniqueId("circuit")
  const recorder = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote Carte",
  })
  // 400 echantillons de 0 a 0,9975 puis le passage de ligne : le serveur enregistre la reference
  const lap = Array.from({ length: 400 }, (_, i) => ({
    track_pos: i / 400,
    lap_time_ms: i * 17,
    ...oval(i / 400),
  }))
  for (let i = 0; i < lap.length; i += 100)
    await recorder.sendSamples(lap.slice(i, i + 100))
  await recorder.sendSamples([
    { completed_laps: 1, last_lap_ms: 6_800, track_pos: 0, ...oval(0) },
  ])
  await expect
    .poll(async () =>
      (await request.get(`${API_URL}/tracks/${track}/reference`)).status()
    )
    .toBe(200)

  const stationId = uniqueId("sim")
  const driver = new FakeAgent(request, {
    stationId,
    track,
    driver: "Pilote Trace",
  })
  await page.goto(`/stations/${stationId}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
  await driver.sendSamples(
    Array.from({ length: 20 }, (_, i) => ({
      track_pos: i / 400,
      ...oval(i / 400),
    }))
  )

  const map = page.getByRole("img", {
    name: new RegExp(`Carte du circuit ${track}`),
  })
  await expect(map).toBeVisible()
  await expect(map.locator('polyline[data-on-track="true"]')).toHaveCount(1)
  await expect(map.locator('polyline[data-on-track="false"]')).toHaveCount(0)

  // sortie de piste : 60 m vers l'interieur de l'ovale
  const pos = 20 / 400
  const { x, z } = oval(pos)
  await driver.sendSamples([
    { track_pos: pos, x: x * 0.8, z: z * 0.8 },
    { track_pos: pos + 0.002, x: x * 0.75, z: z * 0.75 },
  ])
  await expect(map.locator('polyline[data-on-track="false"]')).toHaveCount(1)
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
  const common = {
    lap_time_ms: 41_000,
    last_lap_ms: 108_431,
    best_lap_ms: 107_900,
  }
  // un premier lot declare les postes (GET /stations) ; la page s'ouvre ensuite
  await leader.sendBatch()
  await chaser.sendBatch()
  await page.goto(`/leaderboard?circuit=${track}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )

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

test("le circuit choisi sur le leaderboard vit dans l'URL", async ({
  page,
  request,
}) => {
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

test("trier les temps : le plus rapide d'abord, puis inverse, aria-sort a jour", async ({
  page,
  request,
}) => {
  const track = uniqueId("circuit")
  const slow = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote A",
  })
  const fast = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote B",
  })
  // ce poste est declare mais ne repasse jamais par le flux : ses temps restent inconnus (n.d.)
  const silent = new FakeAgent(request, {
    stationId: uniqueId("sim"),
    track,
    driver: "Pilote C",
  })
  await slow.sendBatch()
  await fast.sendBatch()
  await silent.sendBatch()
  await page.goto(`/leaderboard?circuit=${track}`)
  await expect(page.getByRole("status")).toContainText(
    "Flux en direct connecté"
  )
  await slow.sendBatch({ best_lap_ms: 110_000 })
  await fast.sendBatch({ best_lap_ms: 105_000 })
  await expect(page.getByRole("row", { name: /Pilote B/ })).toContainText(
    "1:45,000"
  )

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
      await expect(page.getByRole("status")).toContainText(
        "Flux en direct connecté"
      )
      // scrollWidth > clientWidth sur <html> = la page deborde du telephone
      const { scrollWidth, clientWidth } = await page
        .locator("html")
        .evaluate((html) => ({
          scrollWidth: html.scrollWidth,
          clientWidth: html.clientWidth,
        }))
      expect(
        scrollWidth,
        `debordement horizontal sur ${path}`
      ).toBeLessThanOrEqual(clientWidth)
    }
  })

  test("l'ecran Direct rempli tient dans la largeur du telephone", async ({
    page,
    request,
  }) => {
    const stationId = uniqueId("sim")
    const agent = new FakeAgent(request, {
      stationId,
      track: "nurburgring",
      driver: "Pilote Mobile",
    })
    await page.goto(`/stations/${stationId}`)
    await expect(page.getByRole("status")).toContainText(
      "Flux en direct connecté"
    )
    await agent.sendBatch({ completed_laps: 0, track_flags: ["green"] })
    await agent.sendBatch({ completed_laps: 1, last_lap_ms: 146_460 })
    await expect(
      page.getByRole("img", { name: /Jauge de vitesse/ })
    ).toBeVisible()

    const { scrollWidth, clientWidth } = await page
      .locator("html")
      .evaluate((html) => ({
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
      }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
