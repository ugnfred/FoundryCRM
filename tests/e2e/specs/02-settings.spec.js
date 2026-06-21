// @ts-check
import { test, expect } from '@playwright/test'

test.use({ storageState: './fixtures/auth.json' })

/**
 * 02-settings.spec.js — Settings page: Products, Companies, Company Settings
 *
 * The Settings forms use <Label> + <Input> WITHOUT htmlFor/id pairing, so
 * getByLabel() doesn't work — use input[name="..."] selectors instead.
 */

// Unique suffix to avoid collisions across runs
const RUN_ID = Date.now()

test.describe('Settings — page loads', () => {
  test('settings page is accessible', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    // Tab strip with Company / Users / Customers / Products
    await expect(page.getByRole('button', { name: 'Company' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Customers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Products' })).toBeVisible()
  })
})

test.describe('Settings — Products tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Products' }).click()
    // Wait for the Add Product card to appear
    await expect(page.getByText('Add Product')).toBeVisible()
  })

  test('create a new product', async ({ page }) => {
    const productName = `E2E Product ${RUN_ID}`

    // Fill the Add Product form — use input[name] since Labels lack htmlFor
    await page.locator('input[name="name"]').fill(productName)
    await page.locator('input[name="hsn_code"]').fill('7325')
    await page.locator('input[name="uom"]').fill('NOS')
    await page.locator('input[name="base_rate"]').fill('500')
    await page.locator('input[name="gst_rate"]').fill('18')
    await page.locator('input[name="category"]').fill('Test')

    // Submit
    await page.getByRole('button', { name: 'Add' }).click()

    // Toast should confirm creation
    await expect(page.locator('text=Product added')).toBeVisible({ timeout: 8_000 })

    // Product appears in the table
    await expect(page.locator(`text=${productName}`)).toBeVisible({ timeout: 8_000 })
  })

  test('search products by name filters the list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('NonExistentProductXYZABC')
      // Table should show empty or no match
      await expect(page.locator('tbody tr')).toHaveCount(0, { timeout: 5_000 })
      await searchInput.clear()
    }
  })

  test('edit a product inline', async ({ page }) => {
    // Click the pencil icon on the first product row
    const firstPencil = page.locator('tbody tr').first().getByRole('button').first()
    await firstPencil.click()

    // An inline edit row appears (blue-50 background)
    const editRow = page.locator('tr.bg-blue-50')
    await expect(editRow).toBeVisible({ timeout: 5_000 })

    // Change the name
    const nameInput = editRow.locator('input').first()
    await nameInput.clear()
    await nameInput.fill(`Edited Product ${RUN_ID}`)

    // Save with the checkmark button
    await editRow.getByRole('button').first().click()

    // Toast confirms update
    await expect(page.locator('text=Product updated')).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Settings — Customers tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Customers' }).click()
    await expect(page.getByText('Add Company')).toBeVisible()
  })

  test('create a customer company', async ({ page }) => {
    const companyName = `E2E Customer ${RUN_ID}`

    // Use input[name] since Labels lack htmlFor
    await page.locator('input[name="name"]').fill(companyName)
    await page.locator('input[name="gstin"]').fill('27ABCDE1234F1Z5')
    await page.locator('input[name="state_code"]').fill('27')
    await page.locator('input[name="city"]').fill('Mumbai')
    // Type select defaults to "buyer" — leave as is

    await page.getByRole('button', { name: 'Add' }).click()

    await expect(page.locator('text=Company added')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator(`text=${companyName}`)).toBeVisible({ timeout: 8_000 })
  })

  test('address field is present in the add form', async ({ page }) => {
    // The Add Company form has an Address input with name="address"
    await expect(page.locator('input[name="address"]')).toBeVisible()
  })
})

test.describe('Settings — Company Settings tab', () => {
  test('company settings form loads', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    // "Company" tab is active by default
    await expect(page.getByText('Company Details')).toBeVisible()
  })

  test('structured address fields are present', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    // Use input[name] since Labels lack htmlFor
    await expect(page.locator('input[name="address_line1"]')).toBeVisible()
    await expect(page.locator('input[name="address_line2"]')).toBeVisible()
    await expect(page.locator('input[name="city"]')).toBeVisible()
    await expect(page.locator('input[name="pincode"]')).toBeVisible()
  })

  test('save company settings — no "None" appears after save', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })

    // Wait for form to be populated from API
    await page.waitForLoadState('networkidle')

    // Use input[name="name"] since Labels lack htmlFor
    const nameInput = page.locator('input[name="name"]').first()
    await expect(nameInput).toBeVisible()

    // Only submit if form is enabled (admin role)
    const saveBtn = page.getByRole('button', { name: /save changes/i })
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 8_000 })

      // After save, the sidebar / page should not show a raw "None" string
      const sidebar = page.locator('aside')
      await expect(sidebar).not.toContainText('None')
    }
  })
})
