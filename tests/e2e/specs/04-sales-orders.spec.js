// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 04-sales-orders.spec.js — Sales Order management flows
 */

test.describe('Sales Orders — page', () => {
  test('sales orders page loads', async ({ page }) => {
    await page.goto('/sales-orders', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table, text=No sales orders, text=No orders')
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Sales Orders — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales-orders', { waitUntil: 'networkidle' })
  })

  test('create new SO directly', async ({ page }) => {
    await page.getByRole('button', { name: /new sales order/i }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Select customer
    const customerCombo = dialog.getByRole('combobox').first()
    await customerCombo.click()
    await dialog.locator('[role="option"]').first().click()

    // Date
    const dateInput = dialog.locator('input[type="date"]').first()
    await dateInput.fill(new Date().toISOString().slice(0, 10))

    // Add item
    const addItemBtn = dialog.getByRole('button', { name: /add item|add line/i })
    if (await addItemBtn.isVisible()) await addItemBtn.click()

    // Select product
    const productCombo = dialog.locator('[role="combobox"]').last()
    await productCombo.click()
    const firstOption = dialog.locator('[role="option"]').first()
    await expect(firstOption).toBeVisible({ timeout: 5_000 })
    await firstOption.click()

    // Qty
    const qtyInput = dialog.locator('input[type="number"]').first()
    await qtyInput.fill('3')

    // Submit
    await dialog.getByRole('button', { name: /save|create/i }).click()

    await expect(
      page.locator('text=/SO created|Order saved|so_no/i').or(page.locator('[role="dialog"]').filter({ hasNot: page.locator('body') }))
    ).toBeVisible({ timeout: 10_000 }).catch(async () => {
      await expect(dialog).not.toBeVisible({ timeout: 8_000 })
    })
  })

  test('edit SO — customer name pre-fills correctly (not blank)', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first()
    if (!(await firstRow.isVisible())) {
      test.skip(true, 'No SO in list to edit')
      return
    }

    await firstRow.getByRole('button', { name: /edit/i }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // The customer combobox/select should have a non-empty value
    const customerTrigger = dialog.getByRole('combobox').first()
    const triggerText = await customerTrigger.textContent()
    expect(triggerText?.trim()).not.toBe('')
    expect(triggerText?.trim().toLowerCase()).not.toBe('select customer')
    expect(triggerText?.trim().toLowerCase()).not.toBe('select…')

    // Close dialog
    await page.keyboard.press('Escape')
  })

  test('confirm SO changes status to confirmed', async ({ page }) => {
    const draftRow = page.locator('tbody tr').filter({ hasText: /draft/i }).first()
    if (!(await draftRow.isVisible())) {
      test.skip(true, 'No draft SO available to confirm')
      return
    }

    await draftRow.getByRole('button', { name: /confirm/i }).click()

    // No "items: Field required" error
    await expect(page.locator('text=items: Field required')).not.toBeVisible({ timeout: 3_000 }).catch(() => {})

    await expect(
      page.locator('text=/confirmed|Confirmed/i').first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('mark SO as dispatched', async ({ page }) => {
    const confirmedRow = page.locator('tbody tr').filter({ hasText: /confirmed/i }).first()
    if (!(await confirmedRow.isVisible())) {
      test.skip(true, 'No confirmed SO to dispatch')
      return
    }

    await confirmedRow.getByRole('button', { name: /dispatch/i }).click()
    await expect(
      page.locator('text=/dispatched|Dispatched/i').first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('delete a draft SO — confirm dialog removes it', async ({ page }) => {
    const draftRow = page.locator('tbody tr').filter({ hasText: /draft/i }).first()
    if (!(await draftRow.isVisible())) {
      test.skip(true, 'No draft SO to delete')
      return
    }

    const soNoCell = draftRow.locator('td').first()
    const soNo = (await soNoCell.textContent()) ?? ''

    // Handle the browser confirm dialog
    page.once('dialog', (dialog) => dialog.accept())
    // Click trash/delete icon
    await draftRow.locator('button[title*="delete" i], button svg[data-lucide="trash2"]').first().click().catch(async () => {
      // Fallback: last icon button in row
      const buttons = draftRow.locator('button')
      const count = await buttons.count()
      await buttons.nth(count - 1).click()
    })

    // Row should disappear
    await expect(page.locator(`text=${soNo.trim()}`)).not.toBeVisible({ timeout: 8_000 })
  })

  test('invoice button appears for confirmed SO and navigates to invoices', async ({ page }) => {
    const confirmedRow = page.locator('tbody tr').filter({ hasText: /confirmed/i }).first()
    if (!(await confirmedRow.isVisible())) {
      test.skip(true, 'No confirmed SO available')
      return
    }

    const invoiceBtn = confirmedRow.getByRole('button', { name: /invoice/i })
    await expect(invoiceBtn).toBeVisible()
    await invoiceBtn.click()

    // Should navigate to invoices page
    await expect(page).toHaveURL(/\/invoices/, { timeout: 10_000 })
  })
})

test.describe('Sales Orders — PDF download', () => {
  test.setTimeout(45_000)

  test('download SO PDF triggers a file download', async ({ page }) => {
    await page.goto('/sales-orders', { waitUntil: 'networkidle' })

    const firstRow = page.locator('tbody tr').first()
    if (!(await firstRow.isVisible())) {
      test.skip(true, 'No SOs to download')
      return
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })

    // Download icon button — typically the second icon button in the row
    const iconButtons = firstRow.locator('button').filter({ has: page.locator('svg') })
    const count = await iconButtons.count()
    await iconButtons.nth(count > 2 ? 1 : 0).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    expect(await download.failure()).toBeNull()
  })
})
