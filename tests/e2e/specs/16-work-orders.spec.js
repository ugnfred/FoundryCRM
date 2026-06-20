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
      page.locator('table, text=No work orders, text=Work Orders')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('New Work Order button exists', async ({ page }) => {
    await page.goto('/work-orders', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /new work order|create work order/i })
    ).toBeVisible()
  })

  // TODO: implement full test
  test.skip('create a work order and verify it appears in list with status', async ({ page }) => {
    // TODO: implement full test
    // 1. Navigate to /work-orders
    // 2. Click "New Work Order"
    // 3. Select product / BOM
    // 4. Fill quantity and planned date
    // 5. Submit — verify WO appears in list with "pending" or "in_progress" status
  })

  // TODO: implement full test
  test.skip('update work order status to in_progress', async ({ page }) => {
    // TODO: implement full test
  })

  // TODO: implement full test
  test.skip('complete a work order and verify stock increases', async ({ page }) => {
    // TODO: implement full test
    // 1. Find an in-progress WO
    // 2. Click "Complete"
    // 3. Verify status changes to "completed"
    // 4. (Optional) navigate to /inventory and verify finished product qty increased
  })
})
