// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 09-proforma.spec.js — Proforma Invoice smoke tests
 *
 * Note: the route is /proforma (not /proforma-invoices).
 */

test.describe('Proforma Invoices', () => {
  test('page loads at /proforma', async ({ page }) => {
    await page.goto('/proforma', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table, text=No proforma, text=No records')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Proforma button exists', async ({ page }) => {
    await page.goto('/proforma', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new proforma|new pi/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create proforma invoice and download PDF', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /proforma
    // 2. Click "New Proforma"
    // 3. Fill customer, date, line items
    // 4. Save — verify PI appears in list
    // 5. Click Download PDF — verify file downloads
  })

  // TODO: implement full test
  test.skip('convert proforma to invoice', async ({ page }) => {
    // TODO: implement full test
    // 1. Find a draft proforma in the list
    // 2. Click "Convert" button
    // 3. Verify redirect to Invoices page or success toast
  })
})
