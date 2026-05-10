import { expect, test, type Page } from '@playwright/test'

async function mockConversation(page: Page, response: Record<string, unknown>) {
  await page.route('**/api/conversation', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(response),
    })
  })
}

const defaultSchema = {
  schemaVersion: 'cmatch.intake.v1',
  source: { rawText: 'test', language: 'en' },
  patientContext: { ageBand: 'adult_18_64', pregnancyStatus: 'not_applicable' },
  complaint: {
    domains: ['pain_musculoskeletal'],
    bodyRegions: ['ankle_foot'],
    symptomQualities: ['pain', 'swelling'],
    duration: 'acute',
    severity: 5,
    functionalImpact: [],
  },
  safety: { route: 'ok_to_match', redFlags: [] },
  preferences: {
    districtsPreferred: ['yau_tsim_mong'],
    languagesPreferred: ['no_preference'],
    treatmentPreferences: ['tuina', 'bonesetting'],
    treatmentAvoidances: [],
  },
  practitionerPreferences: {
    gender: 'unknown',
    availability: { evenings: null, weekends: null },
  },
  extractionMeta: {
    confidence: 'high',
    missingImportantFields: [],
    needsHumanReview: false,
  },
}

test.describe('CMatch chat experience', () => {
  test('navigates from home to match and shows the chat interface', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Find the right Chinese medicine practitioner/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Find your practitioner/ })).toBeVisible()

    await page.getByRole('button', { name: /Find your practitioner/ }).click()
    await expect(page).toHaveURL(/\/match$/)

    await expect(page.locator('.chat-empty-lead')).toHaveText('Describe your symptoms, timing, location and care preferences.')
    await expect(page.getByPlaceholder('Type your concern…')).toBeVisible()
    await expect(page.locator('.quick-picks button')).toHaveCount(3)
    await expect(page.locator('.chat-messages')).toBeVisible()
  })

  test('sends a message and shows AI response with schema and matches', async ({ page }) => {
    await mockConversation(page, {
      text: 'I understand you have an ankle sprain. Let me find the right practitioner for you.',
      schema: defaultSchema,
      status: 'showing_matches',
      matches: [
        {
          practitionerId: 'cmp-004',
          score: 92,
          band: 'Strong match',
          reasons: ['TCM orthopedics / die-da traumatology specialist', 'Located in Mong Kok'],
          cautions: [],
        },
      ],
    })

    await page.goto('/match')

    await page.getByPlaceholder('Type your concern…').fill(
      'I twisted my ankle two days ago. Walking hurts and I prefer a clinic near Mong Kok. I am open to tui na or die-da.',
    )
    await page.locator('.chat-send').click()

    // User bubble appears
    await expect(page.locator('.chat-msg.user')).toHaveCount(1)

    // AI response appears
    await expect(page.locator('.chat-msg.ai')).toHaveCount(1)
    await expect(page.locator('.chat-msg.ai .chat-msg-bubble')).toContainText('ankle sprain')

    // Understanding panel
    await expect(page.locator('.understanding-panel')).toBeVisible()
    await expect(page.locator('.understanding-panel .title-card-header h2')).toHaveText('Here is how CMatch understood your concern')
    await expect(page.locator('.category-tags .schema-tag').first()).toBeVisible()

    // Match cards — top 3 always shown
    await expect(page.locator('.matches-panel')).toBeVisible()
    await expect(page.locator('.match-card')).toHaveCount(3)
    await expect(page.locator('.match-band')).toHaveCount(3)
  })

  test('uses quick-pick buttons to populate the chat', async ({ page }) => {
    await mockConversation(page, {
      text: 'Got it — lower back pain near Wan Chai. Let me ask a few quick questions.',
      schema: {
        ...defaultSchema,
        complaint: {
          ...defaultSchema.complaint,
          domains: ['pain_musculoskeletal'],
          bodyRegions: ['lower_back'],
          symptomQualities: ['dull aching'],
        },
        preferences: {
          ...defaultSchema.preferences,
          districtsPreferred: ['wan_chai'],
          languagesPreferred: ['cantonese'],
          treatmentPreferences: ['acupuncture'],
          treatmentAvoidances: ['herbal_medicine'],
        },
        practitionerPreferences: {
          gender: 'unknown',
          availability: { evenings: null, weekends: null },
        },
      },
      status: 'needs_clarification',
      matches: [],
    })

    await page.goto('/match')

    await page.locator('.quick-picks button').first().click()
    await expect(page.getByPlaceholder('Type your concern…')).toHaveValue(
      'Lower back pain for 3 weeks, worse after sitting, near Wan Chai. Prefer Cantonese, open to acupuncture but not herbs.',
    )

    await page.locator('.chat-send').click()
    await expect(page.locator('.chat-msg.user')).toHaveCount(1)
    await expect(page.locator('.chat-msg.ai')).toHaveCount(1)
    await expect(page.locator('.understanding-panel')).toBeVisible()
  })

  test('shows a safety banner for severe acute symptoms', async ({ page }) => {
    await mockConversation(page, {
      text: 'Chest pressure with arm numbness can be serious. Please seek emergency care immediately.',
      schema: {
        ...defaultSchema,
        complaint: {
          ...defaultSchema.complaint,
          domains: ['cardiovascular_circulation', 'neurological'],
          bodyRegions: ['chest', 'arm_elbow_hand'],
          symptomQualities: ['pressure', 'numbness'],
        },
        safety: { route: 'emergency_now', redFlags: ['Chest pressure with arm numbness'] },
        practitionerPreferences: {
          gender: 'unknown',
          availability: { evenings: null, weekends: null },
        },
      },
      status: 'needs_clarification',
      matches: [],
    })

    await page.goto('/match')

    await page.getByPlaceholder('Type your concern…').fill(
      'I have severe crushing pressure in my chest and my left arm feels numb.',
    )
    await page.locator('.chat-send').click()

    await expect(page.locator('.safety-banner.emergency')).toBeVisible()
    await expect(page.locator('.safety-banner.emergency')).toContainText('Emergency')
  })

  test('navigates to debug page from menu', async ({ page }) => {
    await page.goto('/match')
    await page.locator('.menu-dot').click()
    await page.getByRole('button', { name: 'Debug' }).click()
    await expect(page).toHaveURL(/\/debug$/)
    await expect(page.locator('.debug-page h1')).toHaveText('Debug')
  })
})
