import { expect, test } from '@playwright/test';

test('loads app and renders core controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hebrew Vocabulary by Chapter' })).toBeVisible();
  await expect(page.getByLabel('Book')).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate (Vocabulary|Frequency List)/ })).toBeVisible();
});
