import { expect, test } from '@playwright/test'

test('local CMatch API reports health and model configuration', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:8787/api/health')
  expect(response.ok()).toBeTruthy()

  const body = await response.json()
  expect(body).toMatchObject({
    ok: true,
    service: 'cmatch-api',
    model: 'deepseek-chat',
  })
  expect(typeof body.deepseekConfigured).toBe('boolean')
})
