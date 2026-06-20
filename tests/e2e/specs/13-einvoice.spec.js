// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 13-einvoice.spec.js — E-Invoice smoke tests
 *
 * We do NOT call the real NIC API in tests. We only verify that:
 *  - The page renders the correct invoice list
 *  - The Generate IRN button / form is accessible
 */

test.describe('E-Invoice', () => {
  test('page loads at /einvoice', async ({ page }) => {
    await page.goto('/einvoice', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table, text=No invoices, text=E-Invoice, text=IRN')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('table shows invoices eligible for IRN or empty state', async ({ page }) => {
    await page.goto('/einvoice', { waitUntil: 'networkidle' })
    const body = page.locator('body')
    await expect(body).not.toContainText('Something went wrong')

    // Either table rows or an empty message
    const tableOrEmpty = page.locator('tbody tr, text=/no invoices|no eligible/i')
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Generate IRN button exists (does not need to fire real API)', async ({ page }) => {
    await page.goto('/einvoice', { waitUntil: 'networkidle' })

    const invoiceRow = page.locator('tbody tr').first()
    if (!(await invoiceRow.isVisible())) {
      // No invoices — just check the page didn't crash
      await expect(page.locator('body')).not.toContainText('Something went wrong')
      return
    }

    // There should be a "Generate" or "IRN" button in the row
    const genBtn = invoiceRow.getByRole('button', { name: /generate|irn|e-invoice/i })
    await expect(genBtn).toBeVisible()
  })

  // TODO: implement full test
  test.skip('generate IRN opens form/modal (sandbox mode only)', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /einvoice
    // 2. Click Generate IRN on a valid invoice
    // 3. Verify a dialog or confirmation appears
    // 4. Do NOT submit — just verify the UI state (avoid hitting NIC sandbox)
  })

  // TODO: implement full test
  test.skip('E-Way Bill generation form opens', async ({ page }) => {
    // TODO: implement full test
  })
})
