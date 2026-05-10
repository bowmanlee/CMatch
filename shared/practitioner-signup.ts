import type { HKDistrict, Language, Specialty, TreatmentModality, AgeBand } from './practitioners.ts'

/**
 * Schema for a practitioner registration application.
 * Sufficient to populate the Practitioner schema once approved.
 */
export type PractitionerSignup = {
  // Identity
  fullName: string
  title: string
  gender: 'female' | 'male'

  // Contact
  email: string
  phone: string

  // Clinic
  clinicName: string
  districts: HKDistrict[]
  areas: string[]
  mtrNearby: string[]

  // Languages spoken
  languages: Language[]

  // Clinical
  specialties: Specialty[]
  modalities: TreatmentModality[]

  // Patient acceptance
  acceptsAgeBands: AgeBand[]
  acceptsPregnancyRelated: boolean
  acceptsChildren: boolean

  // Availability
  availabilityNext: string
  availabilityEvenings: boolean
  availabilityWeekends: boolean
  acceptingNewPatients: boolean

  // Profile
  experienceYears: number
  priceRange: '$' | '$$' | '$$$' | '$$$$'
  bio: string

  // Meta
  submittedAt: string
  id: string
  status: 'pending' | 'approved' | 'rejected'
}
