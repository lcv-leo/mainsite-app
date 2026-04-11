/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('page loads and displays a post title', async ({ page }) => {
    await page.goto('/');
    // Post title should render within the main content area
    const title = page.locator('.h1-title').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
    const text = await title.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('post content area renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.post-content-area').first()).toBeVisible({ timeout: 15_000 });
  });

  test('share bar is visible with action buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.share-bar').first()).toBeVisible({ timeout: 15_000 });
    // At least WhatsApp and copy link buttons should exist
    await expect(page.locator('.share-whatsapp').first()).toBeVisible();
    await expect(page.locator('.share-link').first()).toBeVisible();
  });

  test('floating controls are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.floating-controls')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Accessibility', () => {
  test('page has a main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });

  test('images have alt attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const images = page.locator('img:visible');
    const count = await images.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });
});
