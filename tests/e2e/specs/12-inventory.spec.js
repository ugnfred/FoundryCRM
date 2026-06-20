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
      page.locator('table, text=No stock, text=No inventory, text=No records')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('stock table shows products (or empty state)', async ({ page }) => {
    await page.goto('/inventory', { waitUntil: 'networkidle' })
    // Table header columns or empty-state message
    await expect(
      page.locator('thead th, text=No stock records, text=No products')
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
    // 1. Navigate to /inventory
    // 2. Note the current qty for a product
    // 3. Click the Adjust button for that product
    // 4. Fill in adjustment type (add/remove) and quantity
    // 5. Submit and verify the qty changes
    // 6. (Optional) check the ledger view for that product
  })
})
