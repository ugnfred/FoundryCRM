// @ts-check
import { test, expect } from '@playwright/test'

/**
 * 01-auth.spec.js — Authentication flows
 *
 * The login tests intentionally do NOT use the global storageState so we can
 * test the unauthenticated login page. The sidebar/logout tests reuse it.
 */

test.describe('Auth — login page', () => {
  // Override storageState to start unauthenticated for login-page tests
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page loads and shows Foundry ERP heading', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Foundry/i)
    await expect(page.getByText('Foundry ERP')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    const email = process.env.TEST_EMAIL ?? 'admin@foundryerp.test'
    const password = process.env.TEST_PASSWORD ?? ''

    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should navigate away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })

    // Sidebar confirms we're in the app
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 15_000 })
  })

  test('login with wrong password shows an error message', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill('admin@foundryerp.test')
    await page.getByLabel('Password').fill('definitely-wrong-password-xyz')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Stay on /login and show an error
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    // The Login component renders the error in a <p> with text-destructive class
    const errorEl = page.locator('p.text-destructive, [class*="destructive"]').first()
    await expect(errorEl).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Auth — authenticated state', () => {
  // These tests reuse the storageState set in playwright.config.js
  test.use({ storageState: './fixtures/auth.json' })

  test('logged-in user is redirected from /login to dashboard', async ({ page }) => {
    await page.goto('/login')
    // Should bounce to the home route immediately
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('logged-in user sees the navigation sidebar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Check a few nav links are present
    await expect(sidebar.getByRole('link', { name: /quotations/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /invoices/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /settings/i })).toBeVisible()
  })

  test('dashboard page loads without errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // No JS error dialog or crash banner
    const body = page.locator('body')
    await expect(body).not.toContainText('Something went wrong', { timeout: 5_000 })
  })
})
