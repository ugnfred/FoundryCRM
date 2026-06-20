// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 10-delivery-challans.spec.js — Delivery Challan smoke tests
 */

test.describe('Delivery Challans', () => {
  test('page loads at /delivery-challans', async ({ page }) => {
    await page.goto('/delivery-challans', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table, text=No delivery challans, text=No records')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Delivery Challan button exists', async ({ page }) => {
    await page.goto('/delivery-challans', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new delivery challan|new dc/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create delivery challan and download PDF', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /delivery-challans
    // 2. Click "New Delivery Challan"
    // 3. Fill customer, date, items (can optionally link to a SO)
    // 4. Save — verify DC appears in list with "draft" status
    // 5. Dispatch the DC — verify status changes to "dispatched"
    // 6. Click Download PDF — verify file downloads with DC number
  })

  // TODO: implement full test
  test.skip('cancel a delivery challan', async ({ page }) => {
    // TODO: implement full test
  })
})
