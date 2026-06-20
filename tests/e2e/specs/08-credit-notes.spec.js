// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 08-credit-notes.spec.js — Credit Note smoke tests
 */

test.describe('Credit Notes', () => {
  test('page loads at /credit-notes', async ({ page }) => {
    await page.goto('/credit-notes', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table, text=No credit notes, text=No records')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Credit Note button exists', async ({ page }) => {
    await page.goto('/credit-notes', { waitUntil: 'networkidle' })
    // Button could be in sidebar actions or page header
    await expect(
      page.getByRole('button', { name: /new credit note|new cn/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create credit note — select invoice, fill reason, save', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /credit-notes
    // 2. Click "New Credit Note"
    // 3. Select a linked invoice
    // 4. Fill in reason / adjustment
    // 5. Submit and verify CN appears in list with "draft" status
    // 6. Issue the CN and verify status changes to "issued"
  })

  // TODO: implement full test
  test.skip('download credit note PDF', async ({ page }) => {
    // TODO: implement full test
  })
})
