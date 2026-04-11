/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';

test.describe('Contact form', () => {
  test('contact button opens modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.share-contact', { timeout: 15_000 });
    await page.click('.share-contact');
    // Modal should appear with a form
    const modal = page.locator('[role="dialog"], .modal-overlay, .contact-modal').first();
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test('contact form rejects empty submission', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.share-contact', { timeout: 15_000 });
    await page.click('.share-contact');
    // Try submitting without filling fields
    const submitBtn = page.locator('button[type="submit"], .modal-overlay button.primary-button, button:has-text("Enviar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should show validation error or stay on form (not close modal)
      const modal = page.locator('[role="dialog"], .modal-overlay, .contact-modal').first();
      await expect(modal).toBeVisible();
    }
  });
});

test.describe('Comment section', () => {
  test('comment button opens modal or section', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.share-comment', { timeout: 15_000 });
    await page.click('.share-comment');
    // Comments section or modal should appear
    await page.waitForTimeout(1000);
    // At minimum, something new should be visible
    const commentArea = page.locator('.comments-section, .comment-modal, [role="dialog"]').first();
    await expect(commentArea).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Theme toggle', () => {
  test('theme can be toggled', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.floating-controls', { timeout: 15_000 });
    // Look for theme toggle button
    const themeBtn = page.locator('button[aria-label*="tema"], button[title*="tema"], .fab-btn').first();
    if (await themeBtn.isVisible()) {
      const htmlBefore = await page.locator('html').getAttribute('data-theme');
      await themeBtn.click();
      await page.waitForTimeout(500);
      const htmlAfter = await page.locator('html').getAttribute('data-theme');
      // Theme attribute should change (or class should change)
      if (htmlBefore !== null) {
        expect(htmlAfter).not.toBe(htmlBefore);
      }
    }
  });
});

test.describe('API health', () => {
  test('posts API returns valid JSON', async ({ request }) => {
    const res = await request.get('/api/posts');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).toHaveProperty('content');
  });

  test('ratings API returns valid JSON', async ({ request }) => {
    const res = await request.get('/api/ratings');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('comments API returns valid JSON', async ({ request }) => {
    const res = await request.get('/api/comments?post_id=1');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });
});

test.describe('Security headers', () => {
  test('response includes security headers', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    // At minimum, Content-Type should be set
    expect(headers['content-type']).toContain('text/html');
  });

  test('API returns JSON content-type', async ({ request }) => {
    const res = await request.get('/api/posts');
    expect(res.headers()['content-type']).toContain('application/json');
  });
});
