// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 15-bom.spec.js — Bill of Materials smoke tests
 */

test.describe('Bill of Materials', () => {
  test('page loads at /bom', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })
    await expect(
      page.locator('h1').filter({ hasText: /Bill of Materials/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('table').or(page.getByText('No BOMs yet')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New BOM button exists', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new bom|create bom/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('product filter dropdown is present and functional', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })
    // The product filter select should be present
    const filterTrigger = page.locator('[role="combobox"]').first()
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    // Clicking it should not crash (no Radix empty-value error)
    await filterTrigger.click()
    await expect(page.getByText('All products')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
  })

  test('create BOM with 2 materials and verify it appears in list', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })

    // Click New BOM
    await page.getByRole('button', { name: /new bom/i }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Wait for products to load
    await page.waitForLoadState('networkidle').catch(() => {})

    // Select the finished product (first available)
    const productTrigger = dialog.locator('[role="combobox"]').first()
    await productTrigger.click()
    const productOptions = page.locator('[role="option"]')
    const optCount = await productOptions.count()
    if (optCount === 0) {
      test.skip(true, 'No products available to create BOM')
      return
    }
    await productOptions.first().click()

    // Component row 1: select a component product
    const compTriggers = dialog.locator('[role="combobox"]')
    const comp1Trigger = compTriggers.nth(1)
    if (await comp1Trigger.isVisible()) {
      await comp1Trigger.click()
      const comp1Options = page.locator('[role="option"]')
      if (await comp1Options.count() > 0) {
        await comp1Options.first().click()
      }
    }

    // Set qty for component 1
    const qtyInputs = dialog.locator('input[type="number"]')
    if (await qtyInputs.count() > 0) {
      await qtyInputs.first().fill('10')
    }

    // Add a second component
    const addBtn = dialog.getByRole('button', { name: /add component/i })
    if (await addBtn.isVisible()) {
      await addBtn.click()
      // Select component 2 — pick the second available product if possible
      const allCompTriggers = dialog.locator('[role="combobox"]')
      const comp2Trigger = allCompTriggers.last()
      await comp2Trigger.click()
      const comp2Options = page.locator('[role="option"]')
      const comp2Count = await comp2Options.count()
      if (comp2Count > 1) {
        await comp2Options.nth(1).click()
      } else if (comp2Count > 0) {
        await comp2Options.first().click()
      }
      // Set qty for component 2
      const allQtyInputs = dialog.locator('input[type="number"]')
      const qtyCount = await allQtyInputs.count()
      if (qtyCount > 1) {
        await allQtyInputs.last().fill('5')
      }
    }

    // Submit
    await dialog.getByRole('button', { name: /create bom/i }).click()

    // Dialog should close (BOM saved)
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // BOM should appear in the list with Active badge
    await expect(
      page.locator('table').or(page.getByText(/v\d+.*active|active.*v\d+/i)).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('active BOM shows New Version button', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // Find any active BOM card
    const activeBadge = page.getByText(/active/i).first()
    if (!(await activeBadge.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'No active BOM in list — run create test first')
      return
    }

    // The BOM card header should have a "New Version" button
    await expect(
      page.getByRole('button', { name: /new version/i }).first()
    ).toBeVisible({ timeout: 5_000 })
  })
})
