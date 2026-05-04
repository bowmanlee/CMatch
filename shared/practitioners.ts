export type Language = 'cantonese' | 'english' | 'mandarin' | 'no_preference'

export type HKDistrict =
  | 'central_and_western'
  | 'wan_chai'
  | 'eastern'
  | 'southern'
  | 'yau_tsim_mong'
  | 'sham_shui_po'
  | 'kowloon_city'
  | 'wong_tai_sin'
  | 'kwun_tong'
  | 'kwai_tsing'
  | 'tsuen_wan'
  | 'tuen_mun'
  | 'yuen_long'
  | 'north'
  | 'tai_po'
  | 'sha_tin'
  | 'sai_kung'
  | 'islands'
  | 'remote_or_no_preference'

export type ComplaintDomain =
  | 'pain_musculoskeletal'
  | 'pain_headache'
  | 'neurological'
  | 'digestive'
  | 'respiratory_allergy'
  | 'skin_dermatology'
  | 'sleep_energy'
  | 'mental_emotional'
  | 'women_health'
  | 'men_health'
  | 'cardiovascular_circulation'
  | 'urinary_kidney'
  | 'ent'
  | 'eye_vision'
  | 'dental_oral'
  | 'endocrine_metabolic'
  | 'oncology_support'
  | 'wellness_prevention'
  | 'unknown'

export type BodyRegion =
  | 'head_face'
  | 'neck'
  | 'shoulder'
  | 'arm_elbow_hand'
  | 'chest'
  | 'upper_back'
  | 'lower_back'
  | 'abdomen'
  | 'pelvis_hip'
  | 'knee'
  | 'ankle_foot'
  | 'skin_general'
  | 'whole_body'
  | 'unknown'

export type TreatmentModality =
  | 'herbal_medicine'
  | 'acupuncture'
  | 'tuina'
  | 'bonesetting'
  | 'cupping'
  | 'moxibustion'
  | 'diet_lifestyle_guidance'
  | 'integrative_referral'

export type SafetyRoute =
  | 'emergency_now'
  | 'urgent_western_medical_review'
  | 'human_review_before_matching'
  | 'ok_to_match'

export type AgeBand =
  | 'adult_18_64'
  | 'older_adult_65_plus'
  | 'teen_13_17'
  | 'child_2_12'
  | 'unknown'

export type Specialty =
  | 'internal_medicine'
  | 'surgery'
  | 'obstetrics_gynecology'
  | 'pediatrics'
  | 'dermatology'
  | 'ophthalmology'
  | 'otorhinolaryngology'
  | 'stomatology'
  | 'oncology'
  | 'orthopedics_traumatology'
  | 'proctology'
  | 'geriatrics'
  | 'acupuncture'
  | 'tuina'
  | 'emergency_medicine'
  | 'rehabilitation_medicine'
  | 'preventive_healthcare'

/**
 * Explicit mapping from patient complaint domains to relevant practitioner specialties.
 * Used by the matching system to map symptom-based complaints to TCM department registrations.
 * Order within each array indicates relevance priority (most relevant first).
 */
export const DOMAIN_TO_SPECIALTIES: Record<ComplaintDomain, Specialty[]> = {
  pain_musculoskeletal: ['orthopedics_traumatology', 'tuina', 'acupuncture', 'internal_medicine', 'rehabilitation_medicine'],
  pain_headache: ['internal_medicine', 'acupuncture', 'tuina'],
  neurological: ['internal_medicine', 'acupuncture', 'rehabilitation_medicine'],
  digestive: ['internal_medicine', 'acupuncture', 'tuina'],
  respiratory_allergy: ['internal_medicine', 'otorhinolaryngology', 'acupuncture', 'pediatrics'],
  skin_dermatology: ['dermatology', 'internal_medicine', 'acupuncture'],
  sleep_energy: ['internal_medicine', 'acupuncture', 'tuina', 'preventive_healthcare'],
  mental_emotional: ['internal_medicine', 'acupuncture', 'preventive_healthcare'],
  women_health: ['obstetrics_gynecology', 'internal_medicine', 'acupuncture'],
  men_health: ['internal_medicine', 'acupuncture', 'surgery'],
  cardiovascular_circulation: ['internal_medicine', 'acupuncture', 'geriatrics'],
  urinary_kidney: ['internal_medicine', 'acupuncture', 'surgery'],
  ent: ['otorhinolaryngology', 'internal_medicine', 'acupuncture'],
  eye_vision: ['ophthalmology', 'internal_medicine', 'acupuncture'],
  dental_oral: ['stomatology', 'internal_medicine'],
  endocrine_metabolic: ['internal_medicine', 'acupuncture', 'preventive_healthcare'],
  oncology_support: ['oncology', 'internal_medicine', 'acupuncture', 'preventive_healthcare'],
  wellness_prevention: ['preventive_healthcare', 'internal_medicine', 'acupuncture', 'tuina'],
  unknown: ['internal_medicine'],
}

export type Practitioner = {
  id: string
  displayName: string
  title: string
  gender: 'female' | 'male'
  clinicName: string
  districts: HKDistrict[]
  areas: string[]
  mtrNearby: string[]
  languages: Language[]
  specialties: Specialty[]
  modalities: TreatmentModality[]
  accepts: {
    ageBands: AgeBand[]
    pregnancyRelated: boolean
    children: boolean
  }
  availability: {
    nextAvailable: string
    evenings: boolean
    weekends: boolean
    acceptingNewPatients: boolean
  }
  experienceYears: number
  priceRange: '$' | '$$' | '$$$'
  bio: string
  profileQuality: number
}
