import { expect, test } from "@playwright/test"

/*
 * PWA : le manifest et ses icones sont servis, et Chrome juge l'application installable
 * (Page.getInstallabilityErrors ne renvoie aucune erreur).
 */

test("le manifest est lie, ses icones existent, Chrome peut installer l'application", async ({
  page,
  request,
}) => {
  await page.goto("/")
  const href = await page.locator('link[rel="manifest"]').getAttribute("href")
  expect(href).toBe("/manifest.webmanifest")

  const response = await request.get(href!)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    short_name: "SimRace",
    start_url: "/",
    display: "standalone",
  })
  const purposes = manifest.icons.map(
    (icon: { purpose: string }) => icon.purpose
  )
  expect(purposes).toContain("maskable")
  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const file = await request.get(icon.src)
    expect(file.ok(), icon.src).toBe(true)
    expect(file.headers()["content-type"]).toContain(icon.type)
  }

  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send(
    "Page.getInstallabilityErrors"
  )
  expect(installabilityErrors).toEqual([])
})
