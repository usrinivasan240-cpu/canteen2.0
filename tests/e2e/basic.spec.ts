import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Esc/);
  });
});

test.describe('Customer Flow', () => {
  test('can view menu', async ({ page }) => {
    await page.goto('/');
    // Check if menu items are visible
    await expect(page.locator('text=Menu')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authentication', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/');
    // Check for login elements
    await expect(page.locator('text=Login')).toBeVisible({ timeout: 10000 });
  });
});