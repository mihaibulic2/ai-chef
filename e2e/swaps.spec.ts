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

/** Ask for pasta and open cook mode for r1; resolves with the cook view on the ingredients page. */
async function openCookR1(page: Page) {
  await fresh(page)
  await askForPasta(page)
  await page.getByTestId('recipe-r1').getByRole('button', { name: 'Cook this' }).click()
  await expect(page.getByTestId('cook')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('ingredients-page')).toHaveCount(1)
}

/** The swap-s1 card and apply button on a given page/step container. */
function swapOn(page: Page, containerTestId: string) {
  const container = page.getByTestId(containerTestId)
  return { card: container.getByTestId('swap-s1'), apply: container.getByTestId('swap-apply-s1') }
}

async function readMood(page: Page): Promise<number> {
  const orb = page.locator('.orb-wrap')
  await expect(orb).toHaveAttribute('data-mood', /^-?\d+(\.\d+)?$/)
  return Number(await orb.getAttribute('data-mood'))
}

test.describe('swaps in cook mode', () => {
  test('ingredients page lists ingredients and the swap card; Start cooking leads to step 1; step 2 shows the swap too', async ({ page }) => {
    await openCookR1(page)
    const ingredients = page.getByTestId('ingredients-page')
    await expect(ingredients).toContainText('Barilla spaghetti')
    await expect(ingredients).toContainText('200 g')

    const onIngredients = swapOn(page, 'ingredients-page')
    await expect(onIngredients.card).toHaveCount(1)
    await expect(onIngredients.card).toContainText('Whole wheat spaghetti')
    await expect(onIngredients.apply).toHaveCount(1)
    await expect(onIngredients.apply).toHaveText('Switch to this')

    const next = page.getByTestId('next')
    await expect(next).toHaveText('Start cooking')
    await next.click()
    await expect(page.getByTestId('step-boil-water')).toBeVisible()
    await expect(next).toHaveText('Next')

    const onStep2 = swapOn(page, 'step-cook-pasta')
    await expect(onStep2.card).toHaveCount(1)
    await expect(onStep2.card).toContainText('Whole wheat spaghetti')
    await expect(onStep2.apply).toHaveCount(1)
    await expect(onStep2.apply).toHaveText('I did this')
  })

  test('applying the swap from the ingredients page: toast, stays in cook, marks Swapped everywhere, survives reload', async ({ page }) => {
    await openCookR1(page)
    const onIngredients = swapOn(page, 'ingredients-page')
    const onStep2 = swapOn(page, 'step-cook-pasta')
    await expect(onIngredients.apply).toHaveCount(1)
    await expect(onStep2.apply).toHaveCount(1)

    await onIngredients.apply.click()

    await expect(page.getByRole('status')).toContainText('Healthier swap')
    await expect(page.getByTestId('cook')).toBeVisible()
    await expect(page.getByTestId('ingredients-page')).toHaveCount(1)

    await expect(onIngredients.card).toContainText('Swapped')
    await expect(onIngredients.apply).toHaveCount(0)
    await expect(onStep2.card).toContainText('Swapped')
    await expect(onStep2.apply).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('cook')).toBeVisible({ timeout: 5000 })
    await expect(swapOn(page, 'ingredients-page').card).toContainText('Swapped')
    await expect(swapOn(page, 'ingredients-page').apply).toHaveCount(0)
    await expect(swapOn(page, 'step-cook-pasta').card).toContainText('Swapped')
    await expect(swapOn(page, 'step-cook-pasta').apply).toHaveCount(0)
  })

  test('applying the swap from step 2 marks Swapped on both pages and stays in cook', async ({ page }) => {
    await openCookR1(page)
    await page.getByTestId('next').click()
    await expect(page.getByTestId('step-boil-water')).toBeVisible()
    await page.getByTestId('next').click()
    await expect(page.getByTestId('step-cook-pasta')).toBeVisible()

    const onIngredients = swapOn(page, 'ingredients-page')
    const onStep2 = swapOn(page, 'step-cook-pasta')
    await expect(onStep2.apply).toHaveText('I did this')
    await onStep2.apply.click()

    await expect(page.getByRole('status')).toContainText('Healthier swap')
    await expect(page.getByTestId('cook')).toBeVisible()
    await expect(page.getByTestId('step-cook-pasta')).toBeVisible()

    await expect(onStep2.card).toContainText('Swapped')
    await expect(onStep2.apply).toHaveCount(0)
    await expect(onIngredients.card).toContainText('Swapped')
    await expect(onIngredients.apply).toHaveCount(0)
  })

  test('after the swap, closing cook mode shows the swap in chat and the orb mood went up', async ({ page }) => {
    await fresh(page)
    await askForPasta(page)
    // The orb lives on the chat screen, so read its mood here, before the swap.
    const before = await readMood(page)
    await page.getByTestId('recipe-r1').getByRole('button', { name: 'Cook this' }).click()
    await expect(page.getByTestId('cook')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('ingredients-page')).toHaveCount(1)

    await swapOn(page, 'ingredients-page').apply.click()
    await expect(page.getByRole('status')).toContainText('Healthier swap')
    await expect(swapOn(page, 'ingredients-page').card).toContainText('Swapped')

    await page.getByTestId('cook-close').click()
    await expect(page.getByTestId('cook')).toHaveCount(0)

    await expect(page.locator('.bubble.user').last()).toContainText('Swapped: Whole wheat spaghetti')
    await expect(page.locator('.bubble').last()).toContainText('Nice.')
    await expect(page.locator('.bubble').last()).not.toHaveClass(/user/)

    const after = await readMood(page)
    expect(after).toBeGreaterThan(before)
  })
})
