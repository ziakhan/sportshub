export async function login(page, base, email, password) {
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500) // hydration
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    const posted = page
      .waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"), { timeout: 8000 })
      .catch(() => null)
    await page.press('input[type="password"]', "Enter")
    await posted
    for (let i = 0; i < 10; i++) {
      const s = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).catch(() => null))
      if (s?.user) return true
      await page.waitForTimeout(1000)
    }
    await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" }).catch(() => {})
    await page.waitForTimeout(1000)
  }
  return false
}
