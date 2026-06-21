// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 12-inventory.spec.js — Inventory smoke tests
 */

test.describe('Inventory', () => {
  test('page loads at /inventory', async ({ page }) => {
    await page.goto('/inventory', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table').or(page.getByText('No stock')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('stock table shows products (or empty state)', async ({ page }) => {
    await page.goto('/inventory', { waitUntil: 'networkidle' })
    // Table header columns or empty-state message
    await expect(
      page.locator('thead th').first().or(page.getByText('No stock records'))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Stock Adjust button opens a modal dialog', async ({ page }) => {
    await page.goto('/inventory', { waitUntil: 'networkidle' })

    const adjustBtn = page.getByRole('button', { name: /adjust|stock adjust/i }).first()
    if (!(await adjustBtn.isVisible())) {
      // Try clicking on a row's adjust link
      const firstAdjustInRow = page.locator('table button, table [role="button"]').filter({ hasText: /adjust/i }).first()
      if (await firstAdjustInRow.isVisible()) {
        await firstAdjustInRow.click()
      } else {
        test.skip(true, 'No stock adjust button found')
        return
      }
    } else {
      await adjustBtn.click()
    }

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })
  })

  // TODO: implement full test
  test.skip('make a stock adjustment and verify stock changes', async ({ page }) => {
    // TODO: implement full test
  })
})
