// @ts-check
/**
 * global-setup.js — runs once before all test files.
 *
 * Logs in via the UI, then saves the browser storage state (cookies + local
 * storage) to fixtures/auth.json so every spec can start already authenticated.
 *
 * Required env vars:
 *   TEST_EMAIL     — e.g. admin@foundryerp.test
 *   TEST_PASSWORD  — the account password
 *   PLAYWRIGHT_BASE_URL (optional) — defaults to https://foundry-crm.vercel.app
 */

import { chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, 'auth.json')

export default async function globalSetup() {
  const email = process.env.TEST_EMAIL ?? 'admin@foundryerp.test'
  const password = process.env.TEST_PASSWORD

  if (!password) {
    throw new Error(
      'TEST_PASSWORD env var is required for Playwright global setup. ' +
      'Set it in your shell or a .env file loaded before running Playwright.'
    )
  }

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? 'https://foundry-crm.vercel.app'

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()

  console.log(`[global-setup] Logging in as ${email} at ${baseURL}`)

  // Navigate to login page
  await page.goto('/login', { waitUntil: 'networkidle' })

  // Fill credentials
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)

  // Submit
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait until redirected away from /login (dashboard loads)
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  })

  // Make sure the sidebar rendered (confirms full auth + data load)
  await page.waitForSelector('nav', { timeout: 15_000 })

  // Persist the authenticated state
  await context.storageState({ path: AUTH_FILE })
  console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`)

  await browser.close()
}
