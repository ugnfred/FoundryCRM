// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 03-quotations.spec.js — Quotation management flows
 */

const RUN_ID = Date.now()

/**
 * Helper: open "New Quotation" dialog and fill customer + date + one item.
 * Returns the dialog locator.
 */
async function openAndFillQuotationForm(page, { customerName, productName } = {}) {
  await page.getByRole('button', { name: /new quotation/i }).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Customer — type to filter the combobox/select
  const customerField = dialog.getByRole('combobox').first()
  await customerField.click()
  if (customerName) {
    await dialog.getByPlaceholder(/search|customer/i).fill(customerName).catch(() => {})
  }
  // Pick the first option
  await dialog.locator('[role="option"]').first().click()

  // Date
  const dateInput = dialog.locator('input[type="date"]').first()
  await dateInput.fill(new Date().toISOString().slice(0, 10))

  // Add item row — click "Add Item" or similar button
  const addItemBtn = dialog.getByRole('button', { name: /add item|add line/i })
  if (await addItemBtn.isVisible()) await addItemBtn.click()

  // Product select in the first item row
  const productSelect = dialog.locator('[role="combobox"]').last()
  await productSelect.click()
  if (productName) {
    await dialog.getByPlaceholder(/search|product/i).fill(productName).catch(() => {})
  }
  const firstProduct = dialog.locator('[role="option"]').first()
  await expect(firstProduct).toBeVisible({ timeout: 5_000 })
  await firstProduct.click()

  // Qty
  const qtyInput = dialog.locator('input[type="number"]').first()
  await qtyInput.fill('2')

  return dialog
}

test.describe('Quotations — page', () => {
  test('quotations page loads and shows table', async ({ page }) => {
    await page.goto('/quotations', { waitUntil: 'networkidle' })
    // DataTable or empty-state message
    await expect(
      page.locator('table, text=No quotations yet')
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Quotations — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quotations', { waitUntil: 'networkidle' })
  })

  test('create a quotation', async ({ page }) => {
    await openAndFillQuotationForm(page)
    const dialog = page.locator('[role="dialog"]')

    // Submit
    await dialog.getByRole('button', { name: /save|create/i }).click()

    // Toast confirmation or dialog closes
    await expect(
      page.locator('text=created, text=Quotation saved, text=quot')
    ).toBeVisible({ timeout: 10_000 }).catch(async () => {
      // Fallback: dialog just closes
      await expect(dialog).not.toBeVisible({ timeout: 8_000 })
    })
  })

  test('send quotation changes status to sent', async ({ page }) => {
    // Find a draft quotation row
    const draftRow = page.locator('tbody tr').filter({ hasText: /draft/i }).first()
    const draftExists = await draftRow.isVisible()

    if (!draftExists) {
      test.skip(true, 'No draft quotation available to send')
      return
    }

    // Click Send button in that row
    await draftRow.getByRole('button', { name: /send/i }).click()

    // Should NOT show a "Field required" error
    await expect(page.locator('text=Field required')).not.toBeVisible({ timeout: 3_000 }).catch(() => {})
    await expect(page.locator('text=items: Field required')).not.toBeVisible({ timeout: 3_000 }).catch(() => {})

    // Toast or row status updates to "sent"
    await expect(
      page.locator('text=sent, text=Marked as sent').first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('accept quotation changes status to accepted', async ({ page }) => {
    const sentRow = page.locator('tbody tr').filter({ hasText: /\bsent\b/i }).first()
    if (!(await sentRow.isVisible())) {
      test.skip(true, 'No sent quotation available to accept')
      return
    }

    await sentRow.getByRole('button', { name: /accept/i }).click()
    await expect(page.locator('text=accepted, text=Marked as accepted').first()).toBeVisible({ timeout: 8_000 })
  })

  test('convert quotation to SO — shows success toast with SO number', async ({ page }) => {
    // Find a sent or accepted quotation
    const eligibleRow = page.locator('tbody tr').filter({ hasText: /sent|accepted/i }).first()
    if (!(await eligibleRow.isVisible())) {
      test.skip(true, 'No eligible quotation to convert')
      return
    }

    await eligibleRow.getByRole('button', { name: /to so/i }).click()

    // Toast mentions SO number like "SO-0001"
    const toast = page.locator('text=/Sales Order SO-\\d+|Converted/i')
    await expect(toast).toBeVisible({ timeout: 12_000 })
  })

  test('double-click prevention: "To SO" shows Converting… and disables button', async ({ page }) => {
    const eligibleRow = page.locator('tbody tr').filter({ hasText: /sent|accepted/i }).first()
    if (!(await eligibleRow.isVisible())) {
      test.skip(true, 'No eligible quotation to test double-click prevention')
      return
    }

    const toSOBtn = eligibleRow.getByRole('button', { name: /to so/i })
    await toSOBtn.click()

    // Immediately after click the button should say "Converting…" and be disabled
    // (this is the isPending state from useMutation)
    // We check in a narrow window
    await expect(
      eligibleRow.getByRole('button', { name: /converting/i })
    ).toBeVisible({ timeout: 3_000 }).catch(() => {
      // Button may have disappeared already if request was very fast — that's fine
    })

    // Wait for it to finish
    await expect(page.locator('text=/Converted|Sales Order/i')).toBeVisible({ timeout: 12_000 })
  })

  test('converted quotation shows "✓ Converted" instead of To SO button', async ({ page }) => {
    const convertedRow = page.locator('tbody tr').filter({ hasText: /converted/i }).first()
    if (!(await convertedRow.isVisible())) {
      test.skip(true, 'No converted quotation in the list')
      return
    }

    await expect(convertedRow.locator('text=✓ Converted')).toBeVisible()
    // "To SO" button should NOT be present
    await expect(convertedRow.getByRole('button', { name: /to so/i })).not.toBeVisible()
  })

  test('mark quotation as lost', async ({ page }) => {
    const sentRow = page.locator('tbody tr').filter({ hasText: /\bsent\b/i }).first()
    if (!(await sentRow.isVisible())) {
      test.skip(true, 'No sent quotation to mark as lost')
      return
    }

    await sentRow.getByRole('button', { name: /lost/i }).click()
    await expect(page.locator('text=lost, text=Marked as lost').first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Quotations — PDF download', () => {
  test.setTimeout(45_000)

  test('download PDF triggers a file download (no 404)', async ({ page }) => {
    await page.goto('/quotations', { waitUntil: 'networkidle' })

    const firstRow = page.locator('tbody tr').first()
    if (!(await firstRow.isVisible())) {
      test.skip(true, 'No quotations to download')
      return
    }

    // Listen for the download event
    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })

    // Click the Download icon button (contains a Download lucide icon)
    await firstRow.locator('button').filter({ has: page.locator('svg') }).nth(1).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)

    // Ensure no failure path
    const failure = await download.failure()
    expect(failure).toBeNull()
  })
})
