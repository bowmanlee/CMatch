import { expect, test, type Page } from '@playwright/test'

async function mockDeepSeekStream(page: Page, extraction: Record<string, unknown>) {
  await page.route('**/api/deepseek/analyze-stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/event-stream; charset=utf-8',
      },
      body: [
        'event: meta',
        'data: {"model":"test-structurer"}',
        '',
        'event: delta',
        `data: ${JSON.stringify({ text: JSON.stringify(extraction) })}`,
        '',
        'event: done',
        'data: {"model":"test-structurer"}',
        '',
        '',
      ].join('\n'),
    })
  })
}

test.describe('CMatch prototype', () => {
  test('renders the core intake and matching experience', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Find the right Chinese medicine practitioner/i })).toBeVisible()
    await page.getByRole('button', { name: /Find (a|your) practitioner/ }).first().click()
    await expect(page).toHaveURL(/\/match$/)
    await expect(page.getByRole('heading', { name: 'Describe your concern' })).toBeVisible()
    await expect(page.getByLabel('Describe your concern')).toBeVisible()
    await expect(page.getByText(/Share symptoms, timing, location/i)).toBeVisible()
    await expect(page.getByText('Developer diagnostics')).toBeVisible()
    await expect(page.getByText('System prompt sent by the local proxy')).toBeVisible()
  })

  test('matches an ankle injury to die-da and exposes the debug schema', async ({ page }) => {
    await mockDeepSeekStream(page, {
      summary: 'An ankle sprain pattern with pain, swelling, and Mong Kok location preference.',
      domains: ['injury_sprain_strain', 'musculoskeletal_pain'],
      bodyRegions: ['ankle_foot'],
      symptomQualities: ['pain', 'swelling'],
      safetyRoute: 'ok_to_match',
      redFlags: ['none detected'],
      missingImportantFields: [],
      confidence: 'high',
      preferences: {
        districtsPreferred: ['yau_tsim_mong'],
        languagesPreferred: ['no_preference'],
        treatmentPreferences: ['tuina', 'bonesetting'],
        treatmentAvoidances: [],
      },
    })
    await page.goto('/')
    await page.getByRole('button', { name: /Find (a|your) practitioner/ }).first().click()

    await page.getByLabel('Describe your concern').fill(
      'I twisted my ankle two days ago. Walking hurts and I prefer a clinic near Mong Kok. I am open to tui na or die-da.',
    )
    await expect(page.getByText('Here is how CMatch understood your concern')).not.toBeVisible()
    await page.getByRole('button', { name: 'Find matches' }).click()

    await expect(page.getByText('Here is how CMatch understood your concern')).toBeVisible()
    await expect(page.getByText('Structured concern')).toBeVisible()
    await expect(page.getByText('Suggested specialists', { exact: true })).toBeVisible()
    await expect(page.getByText('Practitioner database check')).toBeVisible()
    await expect(page.getByText('System prompt sent by the local proxy')).toBeVisible()
    await expect(page.locator('.developer-section')).toContainText(/Latest agent\/local output|Streaming visible output|System prompt/i)
    await expect(page.getByRole('heading', { name: 'Dr. Wong Ka Ho' })).toBeVisible()
    await expect(page.locator('#partners').getByText(/Specialty fit: TCM orthopedics \/ die-da traumatology/)).toBeVisible()

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await page.getByRole('button', { name: 'Schemas' }).click()
    await expect(page.getByRole('heading', { name: 'See every populated schema, enum and scoring step.' })).toBeVisible()
    await expect(page.getByText('Canonical intake schema')).toBeVisible()
    await expect(page.getByText('"injury_sprain_strain"')).toBeVisible()
    await expect(page.getByText('Match scoring visualization')).toBeVisible()
    await expect(page.getByText('Specialty fit').first()).toBeVisible()
  })

  test('runs a built-in dropdown test case', async ({ page }) => {
    await mockDeepSeekStream(page, {
      summary: 'Lower back pain after sitting with Wan Chai, Cantonese, acupuncture, and herb-avoidance preferences.',
      domains: ['musculoskeletal_pain'],
      bodyRegions: ['lower_back'],
      symptomQualities: ['dull aching'],
      safetyRoute: 'ok_to_match',
      redFlags: ['none detected'],
      missingImportantFields: [],
      confidence: 'high',
      preferences: {
        districtsPreferred: ['wan_chai'],
        languagesPreferred: ['cantonese'],
        treatmentPreferences: ['acupuncture'],
        treatmentAvoidances: ['herbal_medicine'],
      },
    })
    await page.goto('/')
    await page.getByRole('button', { name: /Find (a|your) practitioner/ }).first().click()

    await page.getByText('Test cases').click()
    await page.getByRole('button', { name: /Lower back pain · Wan Chai/i }).click()

    await expect(page.getByRole('listbox', { name: 'CMatch test cases' })).not.toBeVisible()
    await expect(page.locator('.readback-copy')).toContainText('Lower back pain for three weeks')
    await expect(page.getByRole('button', { name: 'Edit concern' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
    await expect(page.getByText(/Suggested specialists|Suggested practitioner profiles/).first()).toBeVisible()

    const completeBox = await page.locator('.composer-surface').boundingBox()
    await page.getByRole('button', { name: 'Edit concern' }).click()
    const editBox = await page.locator('.composer-surface').boundingBox()
    expect(editBox?.height).toBe(completeBox?.height)
    await expect(page.getByLabel('Describe your concern')).toBeEditable()
  })

  test('routes severe acute chest symptoms to a safety warning before normal matching', async ({ page }) => {
    await mockDeepSeekStream(page, {
      summary: 'Chest pressure with arm numbness requiring safety gating.',
      domains: ['musculoskeletal_pain'],
      bodyRegions: ['chest', 'arm_elbow_hand'],
      symptomQualities: ['pressure', 'numbness'],
      safetyRoute: 'ok_to_match',
      redFlags: ['none detected'],
      missingImportantFields: [],
      confidence: 'high',
      preferences: {
        districtsPreferred: ['remote_or_no_preference'],
        languagesPreferred: ['no_preference'],
        treatmentPreferences: [],
        treatmentAvoidances: [],
      },
    })
    await page.goto('/')
    await page.getByRole('button', { name: /Find (a|your) practitioner/ }).first().click()

    await page.getByLabel('Describe your concern').fill(
      'I have severe crushing pressure in my chest and my left arm feels numb.',
    )
    await page.getByRole('button', { name: 'Find matches' }).click()

    await expect(page.getByRole('alert')).toContainText('Medical safety boundary')
    await expect(page.getByRole('alert')).toContainText('chest pain, pressure or radiating arm symptoms')
    await expect(page.getByRole('heading', { name: 'Dr. Wong Ka Ho' })).not.toBeVisible()
  })

  test('waits for the structuring stream before publishing multi-issue schema and matches', async ({ page }) => {
    let releaseStream: () => void = () => undefined
    const streamGate = new Promise<void>((resolve) => {
      releaseStream = resolve
    })

    await page.route('**/api/deepseek/analyze-stream', async (route) => {
      await streamGate
      const extraction = JSON.stringify({
        summary: 'Headache and digestive discomfort with location, language, and needle-avoidance preferences.',
        domains: ['headache_migraine', 'digestive_gastrointestinal'],
        bodyRegions: ['head_face', 'abdomen'],
        symptomQualities: ['headache', 'bloating'],
        safetyRoute: 'ok_to_match',
        redFlags: ['none detected'],
        missingImportantFields: [],
        confidence: 'high',
        preferences: {
          districtsPreferred: ['wan_chai', 'central_and_western'],
          languagesPreferred: ['english', 'cantonese'],
          treatmentPreferences: [],
          treatmentAvoidances: ['acupuncture'],
        },
      })

      await route.fulfill({
        status: 200,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/event-stream; charset=utf-8',
        },
        body: [
          'event: meta',
          'data: {"model":"test-structurer"}',
          '',
          'event: delta',
          `data: ${JSON.stringify({ text: extraction })}`,
          '',
          'event: done',
          'data: {"model":"test-structurer"}',
          '',
          '',
        ].join('\n'),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: /Find (a|your) practitioner/ }).first().click()
    await page.getByLabel('Describe your concern').fill(
      'I have headaches and bloating. I prefer English or Cantonese and a clinic near Wan Chai or Central. I want to avoid needles.',
    )
    await page.getByRole('button', { name: 'Find matches' }).click()

    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
    await expect(page.getByText('Here is how CMatch understood your concern')).not.toBeVisible()

    releaseStream()

    await expect(page.getByText('Here is how CMatch understood your concern')).toBeVisible()
    await expect(page.locator('.readback-copy')).toContainText(/headache \/ migraine/i)
    await expect(page.locator('.readback-copy')).toContainText(/digestive \/ gastrointestinal/i)
    await expect(page.locator('.readback-copy')).toContainText(/Central & Western.*Wan Chai|Wan Chai.*Central & Western/i)
    await expect(page.locator('.readback-copy')).toContainText(/Cantonese.*English|English.*Cantonese/i)
    await expect(page.locator('.readback-copy')).toContainText(/Acupuncture/i)
    await expect(page.getByText('Suggested specialists', { exact: true })).toBeVisible()
  })
})
