// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 07-grns.spec.js — Goods Receipt Note smoke tests
 */

test.describe('GRNs', () => {
  test('page loads at /grns', async ({ page }) => {
    await page.goto('/grns', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table').or(page.getByText('No GRNs')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('GRN list shows (may be empty)', async ({ page }) => {
    await page.goto('/grns', { waitUntil: 'networkidle' })
    // Either table or empty message — just confirm the page rendered without error
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toBeTruthy()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  // TODO: implement full test
  test.skip('create GRN from PO — select PO, fill quantities, save', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /grns
    // 2. Click "New GRN" button
    // 3. Select an existing Purchase Order from the dropdown
    // 4. Verify line items pre-fill from the PO
    // 5. Fill received quantities
    // 6. Submit and verify GRN appears in list with correct status
  })

  // TODO: implement full test
  test.skip('download GRN PDF', async ({ page }) => {
    // TODO: implement full test
  })
})
