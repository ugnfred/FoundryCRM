// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 11-advance-receipts.spec.js — Advance Receipts flows
 *
 * ARForm uses Radix UI Select (not native <select>). SelectContent renders in a
 * portal outside the dialog DOM, so [role="option"] must be scoped to `page`, not `dialog`.
 */

const today = new Date().toISOString().slice(0, 10)
const futureDate = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10)

async function openNewAdvanceForm(page) {
  await page.getByRole('button', { name: /new advance/i }).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  return dialog
}

async function selectFirstCustomer(page, dialog) {
  const customerTrigger = dialog.getByRole('combobox').first()
  await customerTrigger.click()
  // Radix SelectContent renders in a portal outside dialog — scope to page
  const firstOption = page.locator('[role="option"]').first()
  await expect(firstOption).toBeVisible({ timeout: 5_000 })
  await firstOption.click()
}

test.describe('Advance Receipts — page', () => {
  test('page loads at /advance-receipts', async ({ page }) => {
    await page.goto('/advance-receipts', { waitUntil: 'networkidle' })
    await expect(page.locator('h1').filter({ hasText: 'Advance Receipts' }).first()).toBeVisible()
    await expect(
      page.locator('table').or(page.getByText('No advance receipts yet')).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Advance Receipts — PDC flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/advance-receipts', { waitUntil: 'networkidle' })
  })

  test('create PDC advance — status shows pending', async ({ page }) => {
    const dialog = await openNewAdvanceForm(page)
    await selectFirstCustomer(page, dialog)

    // Date
    await dialog.locator('input[type="date"]').first().fill(today)

    // Amount
    await dialog.locator('input[type="number"]').fill('5000')

    // Switch to cheque mode
    const modeSelect = dialog.getByRole('combobox').nth(1)
    await modeSelect.click()
    // Portal renders outside dialog
    const chequeOption = page.locator('[role="option"]').filter({ hasText: /cheque/i })
    if (await chequeOption.isVisible()) {
      await chequeOption.click()
    }

    // Enable PDC toggle
    const pdcToggle = dialog.locator('[role="switch"]')
    if (await pdcToggle.isVisible()) {
      const isChecked = await pdcToggle.getAttribute('aria-checked')
      if (isChecked !== 'true') await pdcToggle.click()

      // PDC date input should appear
      await dialog.locator('input[type="date"]').last().fill(futureDate)
    }

    await dialog.getByRole('button', { name: /create advance receipt/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // Toast confirms creation
    await expect(page.locator('text=/advance receipt AR-|created/i').first()).toBeVisible({ timeout: 8_000 })

    // Find the new row — it should show "pending" status
    const pendingBadge = page.locator('tbody tr').filter({ hasText: /pending/i }).first()
    await expect(pendingBadge).toBeVisible({ timeout: 8_000 })
  })

  test('Receive button appears for pending advances', async ({ page }) => {
    const pendingRow = page.locator('tbody tr').filter({ hasText: /pending/i }).first()
    if (!(await pendingRow.isVisible())) {
      test.skip(true, 'No pending advance receipts in list')
      return
    }

    await expect(pendingRow.getByRole('button', { name: /received/i })).toBeVisible()
  })

  test('click Receive on pending PDC — status changes to received', async ({ page }) => {
    const pendingRow = page.locator('tbody tr').filter({ hasText: /pending/i }).first()
    if (!(await pendingRow.isVisible())) {
      test.skip(true, 'No pending advance to receive')
      return
    }

    // The Receive button triggers a confirm() dialog
    page.once('dialog', (d) => d.accept())
    await pendingRow.getByRole('button', { name: /received/i }).click()

    await expect(page.locator('text=PDC marked as received')).toBeVisible({ timeout: 8_000 })

    // Row should now show "received" status
    await expect(page.locator('text=received').first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Advance Receipts — bank transfer', () => {
  test('bank transfer advance status shows received immediately', async ({ page }) => {
    await page.goto('/advance-receipts', { waitUntil: 'networkidle' })
    const dialog = await openNewAdvanceForm(page)
    await selectFirstCustomer(page, dialog)

    await dialog.locator('input[type="date"]').first().fill(today)
    await dialog.locator('input[type="number"]').fill('2000')

    // Mode: bank_transfer is the default — verify and leave it
    const modeTrigger = dialog.getByRole('combobox').nth(1)
    const modeText = await modeTrigger.textContent()
    // It should already say BANK TRANSFER or similar
    if (modeText && !/bank/i.test(modeText)) {
      await modeTrigger.click()
      // Portal renders outside dialog
      const bankOption = page.locator('[role="option"]').filter({ hasText: /bank/i }).first()
      if (await bankOption.isVisible()) await bankOption.click()
    }

    // PDC toggle should be OFF — leave it
    await dialog.getByRole('button', { name: /create advance receipt/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // The new entry should immediately have "received" status (bank transfers are instant)
    await expect(page.locator('text=received').first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Advance Receipts — cancel', () => {
  test('cancel advance receipt — status changes to cancelled', async ({ page }) => {
    await page.goto('/advance-receipts', { waitUntil: 'networkidle' })

    // Find a received or pending advance to cancel
    const cancellableRow = page.locator('tbody tr')
      .filter({ has: page.getByRole('button', { name: /cancel/i }) })
      .first()

    if (!(await cancellableRow.isVisible())) {
      test.skip(true, 'No cancellable advance receipt in list')
      return
    }

    page.once('dialog', (d) => d.accept())
    await cancellableRow.getByRole('button', { name: /cancel/i }).click()

    await expect(page.locator('text=Advance receipt cancelled')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('text=cancelled').first()).toBeVisible({ timeout: 8_000 })
  })
})
