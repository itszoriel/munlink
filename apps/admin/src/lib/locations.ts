/**
 * Static location data for Zambales Province.
 * 
 * SCOPE: This platform is limited to Zambales province only.
 * Olongapo City is explicitly excluded from all logic.
 * 
 * Region 3 data is retained in the database for compatibility,
 * but only Zambales municipalities are exposed to users.
 */

import type { Province, Municipality } from './store'

// Barangay type
export type Barangay = {
  id: number
  name: string
  slug: string
  municipality_id: number
}

// Import static barangay data (mapped by municipality slug)
import barangayData from './barangay_ids.json'

// ============================================================================
// ZAMBALES PROVINCE CONFIGURATION
// ============================================================================

// Province data - Zambales only
export const PROVINCES: Province[] = [
  { id: 6, name: 'Zambales', slug: 'zambales', region_name: 'Zambales' },
]

// Default province for the platform
export const DEFAULT_PROVINCE = PROVINCES[0]
export const ZAMBALES_PROVINCE_ID = 6

// Olongapo City is explicitly excluded
export const EXCLUDED_MUNICIPALITY_SLUGS = ['city-of-olongapo']
export const EXCLUDED_MUNICIPALITY_IDS = [130]

// Municipality ID mapping (slug -> database ID) - Zambales only
const DB_MUNICIPALITY_IDS: Record<string, number> = {
  "botolan": 108,
  "cabangan": 109,
  "candelaria": 110,
  "castillejos": 111,
  "iba": 112,
  "masinloc": 113,
  "palauig": 114,
  "san-antonio-zambales": 115,
  "san-felipe": 116,
  "san-marcelino": 117,
  "san-narciso": 118,
  "santa-cruz": 119,
  "subic": 120,
}

// Municipality data - Zambales only (excluding Olongapo)
const MUNICIPALITIES_DATA: Omit<Municipality, 'id'>[] = [
  { name: 'Botolan', slug: 'botolan', province_id: 6 },
  { name: 'Cabangan', slug: 'cabangan', province_id: 6 },
  { name: 'Candelaria', slug: 'candelaria', province_id: 6 },
  { name: 'Castillejos', slug: 'castillejos', province_id: 6 },
  { name: 'Iba', slug: 'iba', province_id: 6 },
  { name: 'Masinloc', slug: 'masinloc', province_id: 6 },
  { name: 'Palauig', slug: 'palauig', province_id: 6 },
  { name: 'San Antonio', slug: 'san-antonio-zambales', province_id: 6 },
  { name: 'San Felipe', slug: 'san-felipe', province_id: 6 },
  { name: 'San Marcelino', slug: 'san-marcelino', province_id: 6 },
  { name: 'San Narciso', slug: 'san-narciso', province_id: 6 },
  { name: 'Santa Cruz', slug: 'santa-cruz', province_id: 6 },
  { name: 'Subic', slug: 'subic', province_id: 6 },
]

// Generate municipalities with real database IDs
export const MUNICIPALITIES: Municipality[] = MUNICIPALITIES_DATA.map(mun => ({
  id: DB_MUNICIPALITY_IDS[mun.slug] || 0,
  ...mun,
}))

// Valid municipality IDs for Zambales (excluding Olongapo)
export const ZAMBALES_MUNICIPALITY_IDS = Object.values(DB_MUNICIPALITY_IDS)

/**
 * Get all provinces (returns only Zambales)
 */
export function getProvinces(): Province[] {
  return PROVINCES
}

/**
 * Get municipalities in Zambales (excluding Olongapo)
 * Province ID parameter is accepted for API compatibility but ignored.
 */
export function getMunicipalities(_provinceId?: number): Municipality[] {
  // Always return Zambales municipalities only
  return MUNICIPALITIES
}

/**
 * Get a province by ID (only returns Zambales)
 */
export function getProvinceById(id: number): Province | undefined {
  if (id === ZAMBALES_PROVINCE_ID) {
    return DEFAULT_PROVINCE
  }
  return undefined
}

/**
 * Get a province by slug (only returns Zambales)
 */
export function getProvinceBySlug(slug: string): Province | undefined {
  if (slug.toLowerCase() === 'zambales') {
    return DEFAULT_PROVINCE
  }
  return undefined
}

/**
 * Get a municipality by ID (only Zambales municipalities, excluding Olongapo)
 */
export function getMunicipalityById(id: number): Municipality | undefined {
  if (EXCLUDED_MUNICIPALITY_IDS.includes(id)) {
    return undefined
  }
  return MUNICIPALITIES.find(m => m.id === id)
}

/**
 * Get a municipality by slug (only Zambales municipalities, excluding Olongapo)
 */
export function getMunicipalityBySlug(slug: string): Municipality | undefined {
  const normalizedSlug = slug.toLowerCase()
  if (EXCLUDED_MUNICIPALITY_SLUGS.includes(normalizedSlug)) {
    return undefined
  }
  return MUNICIPALITIES.find(m => m.slug === normalizedSlug)
}

/**
 * Check if a municipality ID is valid for Zambales (excludes Olongapo)
 */
export function isValidZambalesMunicipality(id: number): boolean {
  return ZAMBALES_MUNICIPALITY_IDS.includes(id) && !EXCLUDED_MUNICIPALITY_IDS.includes(id)
}

// Static barangay data mapping
const DB_BARANGAY_IDS: Record<string, Barangay[]> = barangayData as any

/**
 * Get barangays by municipality slug (only Zambales municipalities)
 */
export function getBarangaysByMunicipalitySlug(municipalitySlug: string): Barangay[] {
  const slug = municipalitySlug.toLowerCase()
  // Block Olongapo
  if (EXCLUDED_MUNICIPALITY_SLUGS.includes(slug)) {
    return []
  }
  return DB_BARANGAY_IDS[slug] || []
}

/**
 * Get barangays by municipality ID (only Zambales municipalities)
 */
export function getBarangaysByMunicipalityId(municipalityId: number): Barangay[] {
  // Block excluded municipalities
  if (EXCLUDED_MUNICIPALITY_IDS.includes(municipalityId)) {
    return []
  }
  const municipality = getMunicipalityById(municipalityId)
  if (!municipality) return []
  return getBarangaysByMunicipalitySlug(municipality.slug)
}
