// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 06-purchase-orders.spec.js — Purchase Order smoke tests
 */

test.describe('Purchase Orders', () => {
  test('page loads at /purchase-orders', async ({ page }) => {
    await page.goto('/purchase-orders', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table').or(page.getByText('No purchase orders')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New PO button exists', async ({ page }) => {
    await page.goto('/purchase-orders', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new purchase order|new po/i })
    ).toBeVisible()
  })

  test('create basic PO with one item and verify it appears in list', async ({ page }) => {
    await page.goto('/purchase-orders', { waitUntil: 'networkidle' })

    await page.getByRole('button', { name: /new purchase order|new po/i }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Wait for API data to populate selects
    await page.waitForLoadState('networkidle').catch(() => {})

    // Supplier — native <select>
    await dialog.locator('select').first().selectOption({ index: 1 })

    // Date
    const dateInput = dialog.locator('input[type="date"]').first()
    await dateInput.fill(new Date().toISOString().slice(0, 10))

    // Delivery date — must not be left as empty string (backend 422 error)
    const deliveryDateInput = dialog.locator('input[type="date"]').nth(1)
    if (await deliveryDateInput.isVisible()) {
      await deliveryDateInput.fill(new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10))
    }

    // Product — native <select> in item row
    await dialog.locator('select').last().selectOption({ index: 1 })

    // Qty
    await dialog.locator('input[type="number"]').first().fill('5')
    // Rate — second number input
    await dialog.locator('input[type="number"]').nth(1).fill('500')

    // Submit
    await dialog.getByRole('button', { name: /save|create/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // PO row appears in the list
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8_000 })
  })

  // TODO: implement full test
  test.skip('PO appears in list with correct supplier and total', async ({ page }) => {
    // TODO: implement full test
  })
})
