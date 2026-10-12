import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';

test('app window appears', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForSelector('.toolbar');
  await expect(window.locator('.toolbar')).toBeVisible();
  await app.close();
});
