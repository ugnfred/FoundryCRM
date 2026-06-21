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
      page.locator('table').or(page.getByText('No delivery challans')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Delivery Challan button exists', async ({ page }) => {
    await page.goto('/delivery-challans', { waitUntil: 'networkidle' })
    // Button is labelled "New Challan" in the UI
    await expect(
      page.getByRole('button', { name: /new delivery challan|new challan|new dc/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create delivery challan and download PDF', async ({ page }) => {
    // TODO: implement full test
  })

  // TODO: implement full test
  test.skip('cancel a delivery challan', async ({ page }) => {
    // TODO: implement full test
  })
})
