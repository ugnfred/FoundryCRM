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
      page.locator('table, text=No BOMs, text=No bill of materials, text=Bill of Materials')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New BOM button exists', async ({ page }) => {
    await page.goto('/bom', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new bom|create bom/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create BOM with 2 materials and verify it appears in list', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /bom
    // 2. Click "New BOM"
    // 3. Select the finished product
    // 4. Add Material 1: select product, fill qty
    // 5. Add Material 2: select another product, fill qty
    // 6. Submit and verify BOM appears in list with "active" status
    // 7. Verify material count = 2
  })

  // TODO: implement full test
  test.skip('set BOM as active', async ({ page }) => {
    // TODO: implement full test
  })
})
