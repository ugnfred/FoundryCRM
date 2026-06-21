// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 16-work-orders.spec.js — Work Order smoke tests
 */

test.describe('Work Orders', () => {
  test('page loads at /work-orders', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await expect(
      page.locator('table').or(page.getByText('No work orders')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Work Order button exists', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new work order|create work order/i })
    ).toBeVisible()
  })

  test('status filter buttons are present', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: /^All$/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: /open/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /in progress/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /done/i })).toBeVisible()
  })

  test('create a work order and verify it appears in list', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })

    await page.getByRole('button', { name: /new work order/i }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Wait for products to load
    await page.waitForLoadState('networkidle').catch(() => {})

    // Select product (Radix combobox — first trigger is the product selector)
    const productTrigger = dialog.locator('[role="combobox"]').first()
    await productTrigger.click()
    const productOptions = page.locator('[role="option"]')
    const optCount = await productOptions.count()
    if (optCount === 0) {
      test.skip(true, 'No products available to create Work Order')
      return
    }
    await productOptions.first().click()

    // Qty
    await dialog.locator('input[type="number"]').first().fill('10')

    // Target date (optional but good practice)
    const targetDateInput = dialog.locator('input[type="date"]').last()
    if (await targetDateInput.isVisible()) {
      await targetDateInput.fill(new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10))
    }

    // Submit
    await dialog.getByRole('button', { name: /create work order/i }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // WO should appear in the list
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('tbody tr').first().getByText(/WO-\d+/)
    ).toBeVisible({ timeout: 5_000 })
  })

  test('update work order status to in_progress', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // Find an open WO row that has a "Start" button
    const allRows = page.locator('tbody tr')
    const count = await allRows.count()
    let openRow = null
    for (let i = 0; i < Math.min(count, 10); i++) {
      const row = allRows.nth(i)
      const startBtn = row.getByRole('button', { name: /^start$/i })
      if (await startBtn.isVisible()) {
        openRow = row
        break
      }
    }

    if (!openRow) {
      test.skip(true, 'No open Work Orders with Start button — run create test first')
      return
    }

    await openRow.getByRole('button', { name: /^start$/i }).click()

    // Status should update to In Progress in the row
    await expect(
      page.locator('tbody tr').filter({ hasText: /in progress/i }).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('WO detail modal opens on WO number click', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const firstRow = page.locator('tbody tr').first()
    if (!(await firstRow.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'No Work Orders in list')
      return
    }

    // Click the WO number link (first cell, styled as blue link)
    const woLink = firstRow.locator('button').first()
    await woLink.click()

    // Detail dialog should open
    const detail = page.locator('[role="dialog"]')
    await expect(detail).toBeVisible({ timeout: 8_000 })

    // Should show WO number heading and detail fields
    await expect(detail.getByText(/WO-\d+/)).toBeVisible({ timeout: 5_000 })
    await expect(detail.getByText(/Product:/i)).toBeVisible()

    // Close dialog
    await page.keyboard.press('Escape')
    await expect(detail).not.toBeVisible({ timeout: 5_000 })
  })

  test('complete a work order — status changes to done', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // Find a WO with a Complete button (open or in_progress, no shortage)
    const allRows = page.locator('tbody tr')
    const count = await allRows.count()
    let targetRow = null
    for (let i = 0; i < Math.min(count, 10); i++) {
      const row = allRows.nth(i)
      const completeBtn = row.getByRole('button', { name: /complete/i })
      if (await completeBtn.isVisible()) {
        targetRow = row
        break
      }
    }

    if (!targetRow) {
      test.skip(true, 'No completable Work Orders in list')
      return
    }

    // Accept the confirm dialog
    page.once('dialog', d => d.accept())
    await targetRow.getByRole('button', { name: /complete/i }).click()

    // Should see a done badge or the row transitions
    await expect(
      page.locator('tbody tr').filter({ hasText: /done/i }).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})
