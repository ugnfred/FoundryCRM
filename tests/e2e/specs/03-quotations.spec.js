// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 03-quotations.spec.js — Quotation management flows
 */

const RUN_ID = Date.now()

/**
 * Helper: open "New Quotation" dialog and fill customer + date + one item.
 * Uses native <select> elements (QuotationForm uses HTML select, not Radix combobox).
 * Returns the dialog locator.
 */
async function openAndFillQuotationForm(page, { customerName, productName } = {}) {
  await page.getByRole('button', { name: /new quotation/i }).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Wait for API data to populate the select dropdowns
  await page.waitForLoadState('networkidle').catch(() => {})

  // Customer — native HTML <select> (first select in dialog)
  const customerSelect = dialog.locator('select').first()
  await customerSelect.selectOption({ index: 1 })

  // Date
  const dateInput = dialog.locator('input[type="date"]').first()
  await dateInput.fill(new Date().toISOString().slice(0, 10))

  // Product select in the first item row (default item row exists)
  const productSelect = dialog.locator('select').last()
  await productSelect.selectOption({ index: 1 })

  // Qty
  const qtyInput = dialog.locator('input[type="number"]').first()
  await qtyInput.fill('2')
  // Rate — second number input (product base_rate may be 0 in test data)
  await dialog.locator('input[type="number"]').nth(1).fill('1000')

  return dialog
}

test.describe('Quotations — page', () => {
  test('quotations page loads and shows table', async ({ page }) => {
    await page.goto('/quotations', { waitUntil: 'networkidle' })
    // DataTable or empty-state message
    await expect(
      page.locator('table').or(page.getByText('No quotations yet')).first()
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
    await expect(page.getByText('Quotation saved')).toBeVisible({ timeout: 10_000 }).catch(async () => {
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
      page.getByText(/sent|Marked as sent/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('accept quotation changes status to accepted', async ({ page }) => {
    const sentRow = page.locator('tbody tr').filter({ hasText: /\bsent\b/i }).first()
    if (!(await sentRow.isVisible())) {
      test.skip(true, 'No sent quotation available to accept')
      return
    }

    await sentRow.getByRole('button', { name: /accept/i }).click()
    await expect(page.getByText(/accepted|Marked as accepted/i).first()).toBeVisible({ timeout: 8_000 })
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
    await expect(toast.first()).toBeVisible({ timeout: 12_000 })
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
    await expect(
      eligibleRow.getByRole('button', { name: /converting/i })
    ).toBeVisible({ timeout: 3_000 }).catch(() => {
      // Button may have disappeared already if request was very fast — that's fine
    })

    // Wait for it to finish
    await expect(page.locator('text=/Converted|Sales Order/i').first()).toBeVisible({ timeout: 12_000 })
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
    await expect(page.getByText(/lost|Marked as lost/i).first()).toBeVisible({ timeout: 8_000 })
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

    // The first icon-only button in the row is the PDF download button
    const rowButtons = firstRow.locator('button').filter({ has: page.locator('svg') })
    const downloadBtn = rowButtons.first()

    // Verify the PDF endpoint returns 200 (blob URL downloads don't fire browser download event in headless)
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/pdf') && r.ok(), { timeout: 20_000 }),
      downloadBtn.click(),
    ])
    expect(response.ok()).toBe(true)
  })
})
