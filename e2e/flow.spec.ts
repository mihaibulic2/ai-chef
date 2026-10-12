import { expect, test, type Page } from '@playwright/test'

const URL = '?mock=1'

async function fresh(page: Page) {
  await page.goto(URL)
  await page.evaluate(() => localStorage.clear())
  await page.goto(URL)
}

async function askForPasta(page: Page) {
  await page.getByTestId('composer').fill('fun pasta for two')
  await page.getByTestId('send').click()
  await expect(page.locator('.bubble.user')).toContainText('fun pasta for two')
  await expect(page.getByTestId('carousel')).toBeVisible()
  for (const id of ['recipe-r1', 'recipe-r2', 'recipe-r3']) await expect(page.getByTestId(id)).toBeVisible()
}

test.describe('chat and recipes', () => {
  test('home shows status chip and composer', async ({ page }) => {
    await fresh(page)
    await expect(page.getByTestId('status')).toBeVisible()
    await expect(page.getByTestId('composer')).toBeVisible()
    await expect(page.getByTestId('send')).toBeVisible()
  })

  test('sending a request shows a bubble and a three-card carousel with Cook this buttons', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    const carousel = page.getByTestId('carousel')
    for (const id of ['recipe-r1', 'recipe-r2', 'recipe-r3']) {
      await expect(carousel.getByTestId(id).getByRole('button', { name: 'Cook this' })).toBeVisible()
    }
  })

  test('Recommended appears only after the judge returns, on r1 only', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    // The mock judge takes ~1.2 s; immediately after the carousel appears there must be no Recommended chip.
    await expect(page.getByTestId('carousel').getByText('Recommended')).toHaveCount(0)
    await expect(page.getByTestId('carousel').getByText('Recommended')).toHaveCount(1, { timeout: 5000 })
    await expect(page.getByTestId('recipe-r1')).toContainText('Recommended')
    await expect(page.getByTestId('recipe-r2')).not.toContainText('Recommended')
    await expect(page.getByTestId('recipe-r3')).not.toContainText('Recommended')
  })

  test('reloading keeps the chat', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    await page.reload()
    await expect(page.getByTestId('carousel')).toBeVisible()
    await expect(page.locator('.bubble.user')).toContainText('fun pasta for two')
    await expect(page.getByTestId('recipe-r1')).toBeVisible()
  })
})

test.describe('compare grid', () => {
  test('selecting two cards opens the comparison grid', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    const r1 = page.getByTestId('recipe-r1')
    const r2 = page.getByTestId('recipe-r2')
    // Cards start selected: Compare (3) is shown; deselect the third card.
    await expect(page.getByTestId('compare')).toHaveText('Compare (3)')
    await page.getByTestId('recipe-r3').click()
    await expect(r1).toHaveAttribute('aria-pressed', 'true')
    await expect(r2).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('recipe-r3')).not.toHaveAttribute('aria-pressed', 'true')

    const compare = page.getByTestId('compare')
    await expect(compare).toBeVisible()
    await expect(compare).toHaveText('Compare (2)')
    const t1 = (await r1.getByRole('heading').first().textContent().catch(() => null)) ?? (await r1.textContent())
    const t2 = (await r2.getByRole('heading').first().textContent().catch(() => null)) ?? (await r2.textContent())
    await compare.click()

    const grid = page.getByTestId('grid')
    await expect(grid).toBeVisible()
    const headerText = (await grid.textContent()) ?? ''
    expect(headerText).toContain(t1!.trim().slice(0, 12))
    expect(headerText).toContain(t2!.trim().slice(0, 12))
    for (const row of ['Calories', 'Protein', 'Sodium', 'high saturated fat', 'high added sugar', 'nuts']) {
      await expect(grid.getByText(row, { exact: false }).first()).toBeVisible()
    }
    await expect(grid.getByText('Ingredients', { exact: false }).first()).toBeVisible()

    const ing = page.getByTestId('ingredients-r1')
    await expect(ing).toBeVisible()
    const dots = ing.locator('.dot')
    expect(await dots.count()).toBeGreaterThan(0)
    await expect(ing.locator('.dot.loading')).toHaveCount(0, { timeout: 10_000 })
    const n = await dots.count()
    for (let i = 0; i < n; i++) {
      await expect(dots.nth(i)).toHaveAttribute('data-verdict', /^(good|neutral|bad)$/)
    }

    await page.getByTestId('grid-back').click()
    await expect(grid).toHaveCount(0)
    await expect(page.getByTestId('carousel')).toBeVisible()
  })
})

async function openGridAndCookR1(page: Page) {
  await askForPasta(page)
  // Cards start selected; deselect the third so two remain.
  await page.getByTestId('recipe-r3').click()
  await page.getByTestId('compare').click()
  await expect(page.getByTestId('grid')).toBeVisible()
  // Wait for the judge so r1 is known to be the healthiest pick.
  await expect(page.getByTestId('grid')).toBeVisible()
  await page.getByTestId('cook-r1').click()
}

test.describe('cooking', () => {
  test('cooking the healthiest pick shows a toast, then the cook view with timers, steps and wrap-up', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    await expect(page.getByTestId('recipe-r1')).toContainText('Recommended', { timeout: 5000 })
    // Cards start selected; deselect the third so two remain.
    await page.getByTestId('recipe-r3').click()
    await page.getByTestId('compare').click()
    await expect(page.getByTestId('grid')).toBeVisible()
    await page.getByTestId('cook-r1').click()

    await expect(page.getByRole('status')).toContainText('Healthiest pick')
    await expect(page.getByTestId('cook')).toHaveCount(0)
    const cook = page.getByTestId('cook')
    await expect(cook).toBeVisible({ timeout: 5000 })

    await expect(page.getByTestId('step-boil-water')).toBeVisible()
    await page.getByTestId('next').click()
    await expect(page.getByTestId('step-cook-pasta')).toBeVisible()
    await page.getByTestId('start-timer-cook-pasta').click()
    const box = page.getByTestId('timer-cook-pasta')
    await expect(box).toBeVisible()
    await expect(box).toContainText(/\b(9:00|8:5\d)\b/)
    await expect(page.getByTestId('timer-banner')).toBeVisible()
    await expect(page.getByTestId('timer-banner')).toContainText(/\d:\d\d/)

    await page.getByTestId('prev').click()
    await expect(page.getByTestId('step-boil-water')).toBeVisible()
    await page.getByTestId('next').click()
    await expect(page.getByTestId('step-cook-pasta')).toBeVisible()

    // Walk to the last step and finish.
    const next = page.getByTestId('next')
    for (let i = 0; i < 20; i++) {
      if ((await next.textContent())?.trim() === 'See how I did') break
      await next.click()
    }
    await expect(next).toHaveText('See how I did')
    await next.click()
    const wrap = page.getByTestId('wrapup')
    await expect(wrap).toBeVisible({ timeout: 10_000 })
    await expect(wrap.getByRole('heading').first()).not.toBeEmpty()
    await expect(wrap).toContainText('Next time')
    expect(((await wrap.textContent()) ?? '').length).toBeGreaterThan(40)

    await page.getByTestId('cook-close').click()
    await expect(cook).toHaveCount(0)
    await expect(page.getByTestId('carousel')).toBeVisible()
  })

  test('reloading keeps the cook plan', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    await expect(page.getByTestId('recipe-r1')).toContainText('Recommended', { timeout: 5000 })
    await page.getByTestId('recipe-r1').getByRole('button', { name: 'Cook this' }).click()
    await expect(page.getByTestId('cook')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('step-boil-water')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('cook')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('step-boil-water')).toBeVisible()
  })
})

test.describe('settings', () => {
  test('tabs, editing allergens persists across reload', async ({ page }) => {
    await fresh(page)
    await page.getByTestId('settings-btn').click()
    const settings = page.getByTestId('settings')
    await expect(settings).toBeVisible()
    for (const t of ['tab-have', 'tab-profile', 'tab-about', 'tab-storage']) await expect(page.getByTestId(t)).toBeVisible()

    await page.getByTestId('tab-profile').click()
    const field = page.getByTestId('field-allergensText')
    await expect(field).toHaveValue(/nuts/i)
    await field.fill('eggs')
    await page.getByTestId('save').click()

    await page.reload()
    await page.getByTestId('settings-btn').click()
    await page.getByTestId('tab-profile').click()
    await expect(page.getByTestId('field-allergensText')).toHaveValue('eggs')
  })

  test('storage tab lists chats; delete and clear-all work and reset settings', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)

    await page.getByTestId('settings-btn').click()
    await page.getByTestId('tab-profile').click()
    await page.getByTestId('field-allergensText').fill('eggs')
    await page.getByTestId('save').click()

    await expect(page.getByTestId('settings')).toBeVisible()
    await page.getByTestId('tab-storage').click()
    const rows = page.locator('[data-testid^="chat-row-"]')
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()
    expect(before).toBeGreaterThan(0)
    await expect(rows.first().getByRole('button', { name: 'Delete' })).toBeVisible()

    page.once('dialog', (d) => d.accept())
    await page.getByTestId('clear-all').click()
    await expect(rows).toHaveCount(0)

    // Clear-all leaves settings; reopen to check the reset.
    if (!(await page.getByTestId('settings').isVisible())) await page.getByTestId('settings-btn').click()
    await page.getByTestId('tab-profile').click()
    await expect(page.getByTestId('field-allergensText')).toHaveValue(/nuts/i)
  })

  test('deleting a single chat row removes it', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    await page.getByTestId('settings-btn').click()
    await page.getByTestId('tab-storage').click()
    const rows = page.locator('[data-testid^="chat-row-"]')
    await expect(rows.first()).toBeVisible()
    const id = await rows.first().getAttribute('data-testid')
    expect(id).toMatch(/^chat-row-/)
    page.once('dialog', (d) => d.accept())
    await rows.first().getByRole('button', { name: 'Delete' }).click()
    // The deleted chat is gone (the app may create a fresh empty current chat in its place).
    await expect(page.getByTestId(id!)).toHaveCount(0)
  })

  test('Run checks ends with four ok checks in mock mode', async ({ page }) => {
    await fresh(page)
    await page.getByTestId('settings-btn').click()
    await page.getByRole('button', { name: 'Run checks' }).click()
    const checks = page.getByTestId('checks')
    await expect(checks).toBeVisible()
    const rows = checks.locator('[data-check]')
    await expect(rows).toHaveCount(4)
    for (let i = 0; i < 4; i++) await expect(rows.nth(i)).toHaveAttribute('data-check', 'ok', { timeout: 15_000 })
  })
})
