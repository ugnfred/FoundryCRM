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
      page.locator('table, text=No purchase orders, text=No POs')
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

    // Supplier
    const supplierCombo = dialog.getByRole('combobox').first()
    await supplierCombo.click()
    const firstOption = dialog.locator('[role="option"]').first()
    await expect(firstOption).toBeVisible({ timeout: 5_000 })
    await firstOption.click()

    // Date
    const dateInput = dialog.locator('input[type="date"]').first()
    await dateInput.fill(new Date().toISOString().slice(0, 10))

    // Add item
    const addItemBtn = dialog.getByRole('button', { name: /add item|add line/i })
    if (await addItemBtn.isVisible()) await addItemBtn.click()

    // Product
    const productCombo = dialog.locator('[role="combobox"]').last()
    await productCombo.click()
    const firstProduct = dialog.locator('[role="option"]').first()
    await expect(firstProduct).toBeVisible({ timeout: 5_000 })
    await firstProduct.click()

    // Qty
    await dialog.locator('input[type="number"]').first().fill('5')

    // Submit
    await dialog.getByRole('button', { name: /save|create/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // PO row appears in the list
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8_000 })
  })

  // TODO: implement full test
  test.skip('PO appears in list with correct supplier and total', async ({ page }) => {
    // TODO: implement full test
  })
})
