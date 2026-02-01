export type Region3Seal = {
  src: string
  alt: string
  kind: 'municipality' | 'province' | 'fallback'
}

// Region 3 municipality→province map source of truth (used for reliable province fallback)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import is handled by Vite in app builds
import region3Locations from '../../../../data/locations/region3_locations.json'

function normalize(input?: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ')
}

function slugify(input?: string): string {
  return normalize(input)
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
}

const provinceSlugMap: Record<string, string> = {
  aurora: 'aurora',
  bataan: 'bataan',
  bulacan: 'bulacan',
  'nueva ecija': 'nueva-ecija',
  'nueva-ecija': 'nueva-ecija',
  pampanga: 'pampanga',
  tarlac: 'tarlac',
  zambales: 'zambales',
}

function buildMunicipalityToProvinceSlug(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const data = region3Locations as Record<string, Record<string, unknown>>
    for (const provinceName of Object.keys(data || {})) {
      const provSlug = provinceSlugMap[normalize(provinceName)] || slugify(provinceName)
      const municipalities = Object.keys((data as any)[provinceName] || {})
      for (const m of municipalities) {
        const n = normalize(m)
        const s = slugify(m)
        if (n) out[n] = provSlug
        if (s) out[s] = provSlug
      }
    }
  } catch {
    // ignore – fallback logic will cover
  }
  return out
}

const municipalityToProvinceSlug = buildMunicipalityToProvinceSlug()

function deriveProvinceFromMunicipality(municipality?: string): string | null {
  const raw = normalize(municipality)
  const candidates = [raw, slugify(raw)]
  for (const c of candidates) {
    if (c && municipalityToProvinceSlug[c]) return municipalityToProvinceSlug[c]
  }
  return null
}

// ============================================================================
// Municipality Seals for Region 3
// ============================================================================
// New consistent path structure: /logos/municipalities/{province-slug}/{municipality-slug}/{filename}
// Keys include both slug and normalized name forms for resilience.

const municipalitySeals: Record<string, string> = {
  // ==========================================
  // AURORA PROVINCE
  // ==========================================
  baler: '/logos/municipalities/aurora/baler/Ph_seal_aurora_baler.png',
  casiguran: '/logos/municipalities/aurora/casiguran/Seal_of_Casiguran_Aurora.png',
  dilasag: '/logos/municipalities/aurora/dilasag/Dilasag.png',
  dinalungan: '/logos/municipalities/aurora/dinalungan/Dinalungan.png',
  dingalan: '/logos/municipalities/aurora/dingalan/Dingalan.png',
  dipaculao: '/logos/municipalities/aurora/dipaculao/Dipaculao.png',
  'maria aurora': '/logos/municipalities/aurora/maria-aurora/Maria_Aurora (1).png',
  'maria-aurora': '/logos/municipalities/aurora/maria-aurora/Maria_Aurora (1).png',
  'san luis': '/logos/municipalities/aurora/san-luis/San Luis.png',
  'san-luis': '/logos/municipalities/aurora/san-luis/San Luis.png',
  'san luis aurora': '/logos/municipalities/aurora/san-luis/San Luis.png',
  'san-luis-aurora': '/logos/municipalities/aurora/san-luis/San Luis.png',

  // ==========================================
  // BATAAN PROVINCE
  // ==========================================
  abucay: '/logos/municipalities/bataan/abucay/Abucay_Bataan.png',
  bagac: '/logos/municipalities/bataan/bagac/Bagac_Bataan.png',
  'city of balanga': '/logos/municipalities/bataan/city-of-balanga/Balanga_Bataan.png',
  'city-of-balanga': '/logos/municipalities/bataan/city-of-balanga/Balanga_Bataan.png',
  balanga: '/logos/municipalities/bataan/city-of-balanga/Balanga_Bataan.png',
  dinalupihan: '/logos/municipalities/bataan/dinalupihan/Dinalupihan_Bataan.png',
  hermosa: '/logos/municipalities/bataan/hermosa/Hermosa_Bataan.png',
  limay: '/logos/municipalities/bataan/limay/Limay_Bataan.png',
  mariveles: '/logos/municipalities/bataan/mariveles/LGULOGO2018240X240.png',
  morong: '/logos/municipalities/bataan/morong/Morong_Bataan.png',
  orani: '/logos/municipalities/bataan/orani/Orani_Bataan.png',
  orion: '/logos/municipalities/bataan/orion/Orion_Bataan.png',
  pilar: '/logos/municipalities/bataan/pilar/Pilar_Bataan.png',
  samal: '/logos/municipalities/bataan/samal/Samal_Bataan.png',

  // ==========================================
  // BULACAN PROVINCE
  // ==========================================
  angat: '/logos/municipalities/bulacan/angat/Angat_Bulacan.png',
  balagtas: '/logos/municipalities/bulacan/balagtas/Balagtas.png',
  baliuag: '/logos/municipalities/bulacan/city-of-baliwag/Ph_seal_bulacan_baliuag.png',
  baliwag: '/logos/municipalities/bulacan/city-of-baliwag/Ph_seal_bulacan_baliuag.png',
  'city of baliwag': '/logos/municipalities/bulacan/city-of-baliwag/Ph_seal_bulacan_baliuag.png',
  'city-of-baliwag': '/logos/municipalities/bulacan/city-of-baliwag/Ph_seal_bulacan_baliuag.png',
  bocaue: '/logos/municipalities/bulacan/bocaue/Bocaue_Bulacan.png',
  bulakan: '/logos/municipalities/bulacan/bulacan/1280px-Seal_of_Bulakan.png',
  bustos: '/logos/municipalities/bulacan/bustos/Official_Seal_of_Bustos,_Bulacan_(2010-Smaller_Size).png',
  calumpit: '/logos/municipalities/bulacan/calumpit/Calumpit_Bulacan.png',
  'dona remedios trinidad': '/logos/municipalities/bulacan/dona-remedios-trinidad/Doña Remedios Trinidad.png',
  'dona-remedios-trinidad': '/logos/municipalities/bulacan/dona-remedios-trinidad/Doña Remedios Trinidad.png',
  drt: '/logos/municipalities/bulacan/dona-remedios-trinidad/Doña Remedios Trinidad.png',
  guiguinto: '/logos/municipalities/bulacan/guiguinto/Guiguinto.png',
  hagonoy: '/logos/municipalities/bulacan/hagonoy/Hagonoy_Bulacan.png',
  malolos: '/logos/municipalities/bulacan/city-of-malolos/Ph_seal_bulacan_malolos.png',
  'city of malolos': '/logos/municipalities/bulacan/city-of-malolos/Ph_seal_bulacan_malolos.png',
  'city-of-malolos': '/logos/municipalities/bulacan/city-of-malolos/Ph_seal_bulacan_malolos.png',
  marilao: '/logos/municipalities/bulacan/marilao/Marilao_Bulacan.png',
  meycauayan: '/logos/municipalities/bulacan/city-of-meycauayan/City_of_Meycauayan_Seal.png',
  'city of meycauayan': '/logos/municipalities/bulacan/city-of-meycauayan/City_of_Meycauayan_Seal.png',
  'city-of-meycauayan': '/logos/municipalities/bulacan/city-of-meycauayan/City_of_Meycauayan_Seal.png',
  norzagaray: '/logos/municipalities/bulacan/norzagaray/Norzagaray_Bulacan.png',
  obando: '/logos/municipalities/bulacan/obando/Obando_Bulacan.png',
  pandi: '/logos/municipalities/bulacan/pandi/Pandi_Bulacan.png',
  paombong: '/logos/municipalities/bulacan/paombong/Paombong_Bulacan.png',
  plaridel: '/logos/municipalities/bulacan/plaridel/Plaridel_Bulacan.png',
  pulilan: '/logos/municipalities/bulacan/pulilan/Pulilan_Bulacan_Official_Logo.png',
  'san ildefonso': '/logos/municipalities/bulacan/san-ildefonso/San_Ildefonso_Bulacan.png',
  'san-ildefonso': '/logos/municipalities/bulacan/san-ildefonso/San_Ildefonso_Bulacan.png',
  'san jose del monte': '/logos/municipalities/bulacan/city-of-san-jose-del-monte/Ph_seal_bulacan_sanjose.png',
  'san-jose-del-monte': '/logos/municipalities/bulacan/city-of-san-jose-del-monte/Ph_seal_bulacan_sanjose.png',
  'city of san jose del monte': '/logos/municipalities/bulacan/city-of-san-jose-del-monte/Ph_seal_bulacan_sanjose.png',
  'city-of-san-jose-del-monte': '/logos/municipalities/bulacan/city-of-san-jose-del-monte/Ph_seal_bulacan_sanjose.png',
  'san miguel': '/logos/municipalities/bulacan/san-miguel/San_Miguel_Bulacan.png',
  'san-miguel': '/logos/municipalities/bulacan/san-miguel/San_Miguel_Bulacan.png',
  'san rafael': '/logos/municipalities/bulacan/san-rafael/San_Rafael_Bulacan.png',
  'san-rafael': '/logos/municipalities/bulacan/san-rafael/San_Rafael_Bulacan.png',
  'santa maria': '/logos/municipalities/bulacan/santa-maria/Ph_seal_bulacan_santamaria.png',
  'santa-maria': '/logos/municipalities/bulacan/santa-maria/Ph_seal_bulacan_santamaria.png',

  // ==========================================
  // NUEVA ECIJA PROVINCE
  // ==========================================
  aliaga: '/logos/municipalities/nueva-ecija/aliaga/Aliaga_Nueva_Ecija.png',
  bongabon: '/logos/municipalities/nueva-ecija/bongabon/Bongabon_Nueva_Ecija.png',
  cabanatuan: '/logos/municipalities/nueva-ecija/city-of-cabanatuan/Cabanatuan_City.png',
  'city of cabanatuan': '/logos/municipalities/nueva-ecija/city-of-cabanatuan/Cabanatuan_City.png',
  'city-of-cabanatuan': '/logos/municipalities/nueva-ecija/city-of-cabanatuan/Cabanatuan_City.png',
  cabiao: '/logos/municipalities/nueva-ecija/cabiao/Cabiao_Nueva_Ecija.png',
  carranglan: '/logos/municipalities/nueva-ecija/carranglan/Carrangalan_Nueva_Ecija.png',
  cuyapo: '/logos/municipalities/nueva-ecija/cuyapo/Cuyapo_Nueva_Ecija.png',
  gabaldon: '/logos/municipalities/nueva-ecija/gabaldon/Gabaldon_Nueva_Ecija.png',
  gapan: '/logos/municipalities/nueva-ecija/city-of-gapan/Ph_seal_nueva_ecija_gapan.png',
  'city of gapan': '/logos/municipalities/nueva-ecija/city-of-gapan/Ph_seal_nueva_ecija_gapan.png',
  'city-of-gapan': '/logos/municipalities/nueva-ecija/city-of-gapan/Ph_seal_nueva_ecija_gapan.png',
  'general mamerto natividad': '/logos/municipalities/nueva-ecija/general-mamerto-natividad/General_Mamerto_Natividad_Nueva_Ecija.png',
  'general-mamerto-natividad': '/logos/municipalities/nueva-ecija/general-mamerto-natividad/General_Mamerto_Natividad_Nueva_Ecija.png',
  'gen mamerto natividad': '/logos/municipalities/nueva-ecija/general-mamerto-natividad/General_Mamerto_Natividad_Nueva_Ecija.png',
  'general tinio': '/logos/municipalities/nueva-ecija/general-tinio/General_Tinio_Nueva_Ecija.png',
  'general-tinio': '/logos/municipalities/nueva-ecija/general-tinio/General_Tinio_Nueva_Ecija.png',
  'gen tinio': '/logos/municipalities/nueva-ecija/general-tinio/General_Tinio_Nueva_Ecija.png',
  guimba: '/logos/municipalities/nueva-ecija/guimba/Guimba_Nueva_Ecija.png',
  jaen: '/logos/municipalities/nueva-ecija/jaen/Jaen_Nueva_Ecija.png',
  laur: '/logos/municipalities/nueva-ecija/laur/Laur_Nueva_Ecija.png',
  licab: '/logos/municipalities/nueva-ecija/licab/Licab_Municipal_Seal.png',
  llanera: '/logos/municipalities/nueva-ecija/llanera/Llanera_Nueva_Ecija.png',
  lupao: '/logos/municipalities/nueva-ecija/lupao/Lupao_Nueva_Ecija.png',
  munoz: '/logos/municipalities/nueva-ecija/science-city-of-munoz/Munoz_Nueva_Ecija.png',
  'science city of munoz': '/logos/municipalities/nueva-ecija/science-city-of-munoz/Munoz_Nueva_Ecija.png',
  'science-city-of-munoz': '/logos/municipalities/nueva-ecija/science-city-of-munoz/Munoz_Nueva_Ecija.png',
  nampicuan: '/logos/municipalities/nueva-ecija/nampicuan/Nampicuan_Nueva_Ecija.png',
  palayan: '/logos/municipalities/nueva-ecija/city-of-palayan/Palayan_City,_Nueva_Ecija_new_seal.svg.png',
  'city of palayan': '/logos/municipalities/nueva-ecija/city-of-palayan/Palayan_City,_Nueva_Ecija_new_seal.svg.png',
  'city-of-palayan': '/logos/municipalities/nueva-ecija/city-of-palayan/Palayan_City,_Nueva_Ecija_new_seal.svg.png',
  pantabangan: '/logos/municipalities/nueva-ecija/pantabangan/Pantabangan_Nueva_Ecija.png',
  penaranda: '/logos/municipalities/nueva-ecija/penaranda/Peñaranda_Nueva_Ecija.png',
  quezon: '/logos/municipalities/nueva-ecija/quezon/Quezon_Nueva_Ecija.png',
  rizal: '/logos/municipalities/nueva-ecija/rizal/Rizal_Nueva_Ecija.png',
  'san antonio': '/logos/municipalities/nueva-ecija/san-antonio/San_Antonio_Nueva_Ecija.png',
  'san-antonio': '/logos/municipalities/nueva-ecija/san-antonio/San_Antonio_Nueva_Ecija.png',
  'san antonio nueva ecija': '/logos/municipalities/nueva-ecija/san-antonio/San_Antonio_Nueva_Ecija.png',
  'san-antonio-nueva-ecija': '/logos/municipalities/nueva-ecija/san-antonio/San_Antonio_Nueva_Ecija.png',
  'san isidro': '/logos/municipalities/nueva-ecija/san-isidro/San Isidro.png',
  'san-isidro': '/logos/municipalities/nueva-ecija/san-isidro/San Isidro.png',
  'san jose city': '/logos/municipalities/nueva-ecija/san-jose-city/San_Jose_City.png',
  'san-jose-city': '/logos/municipalities/nueva-ecija/san-jose-city/San_Jose_City.png',
  'san leonardo': '/logos/municipalities/nueva-ecija/san-leonardo/San_Leonardo_Nueva_Ecija.png',
  'san-leonardo': '/logos/municipalities/nueva-ecija/san-leonardo/San_Leonardo_Nueva_Ecija.png',
  'santa rosa': '/logos/municipalities/nueva-ecija/santa-rosa/Santa_Rosa_Nueva_Ecija.png',
  'santa-rosa': '/logos/municipalities/nueva-ecija/santa-rosa/Santa_Rosa_Nueva_Ecija.png',
  'santo domingo': '/logos/municipalities/nueva-ecija/santo-domingo/Santo_Domingo_Nueva_Ecija.png',
  'santo-domingo': '/logos/municipalities/nueva-ecija/santo-domingo/Santo_Domingo_Nueva_Ecija.png',
  talavera: '/logos/municipalities/nueva-ecija/talavera/Talavera_Nueva_Ecija.png',
  talugtug: '/logos/municipalities/nueva-ecija/talugtug/Talugtug_Nueva_Ecija.png',
  zaragoza: '/logos/municipalities/nueva-ecija/zaragoza/Zaragoza_Nueva_Ecija.png',

  // ==========================================
  // PAMPANGA PROVINCE
  // ==========================================
  apalit: '/logos/municipalities/pampanga/apalit/Ph_seal_pampanga_apalit.png',
  arayat: '/logos/municipalities/pampanga/arayat/Arayat_Pampanga.png',
  bacolor: '/logos/municipalities/pampanga/bacolor/Flag_of_Bacolor,_Pampanga.png',
  candaba: '/logos/municipalities/pampanga/candaba/candaba-c079e91e.jpeg',
  floridablanca: '/logos/municipalities/pampanga/floridablanca/Floridablanca_Pampanga.png',
  guagua: '/logos/municipalities/pampanga/guagua/guagualogo.png',
  lubao: '/logos/municipalities/pampanga/lubao/Flag_of_Lubao,_Pampanga.png',
  macabebe: '/logos/municipalities/pampanga/macabebe/macabebe.jpg',
  magalang: '/logos/municipalities/pampanga/magalang/Magalang_Pampanga.png',
  masantol: '/logos/municipalities/pampanga/masantol/Masantol_Pampanga.png',
  mexico: '/logos/municipalities/pampanga/mexico/Mexico_Pampanga.png',
  minalin: '/logos/municipalities/pampanga/minalin/Minalin_Pampanga.jpg',
  porac: '/logos/municipalities/pampanga/porac/Porac.png',
  'san fernando': '/logos/municipalities/pampanga/city-of-san-fernando/Ph_seal_pampanga.png',
  'san-fernando': '/logos/municipalities/pampanga/city-of-san-fernando/Ph_seal_pampanga.png',
  'city of san fernando': '/logos/municipalities/pampanga/city-of-san-fernando/Ph_seal_pampanga.png',
  'city-of-san-fernando': '/logos/municipalities/pampanga/city-of-san-fernando/Ph_seal_pampanga.png',
  'san luis pampanga': '/logos/municipalities/pampanga/san-luis/San_Luis_Pampanga.png',
  'san-luis-pampanga': '/logos/municipalities/pampanga/san-luis/San_Luis_Pampanga.png',
  'san simon': '/logos/municipalities/pampanga/san-simon/San_Simon_Pampanga.png',
  'san-simon': '/logos/municipalities/pampanga/san-simon/San_Simon_Pampanga.png',
  'santa ana': '/logos/municipalities/pampanga/santa-ana/Santa_Ana_Pampanga.png',
  'santa-ana': '/logos/municipalities/pampanga/santa-ana/Santa_Ana_Pampanga.png',
  'santa rita': '/logos/municipalities/pampanga/santa-rita/Santa_Rita_Pampanga.png',
  'santa-rita': '/logos/municipalities/pampanga/santa-rita/Santa_Rita_Pampanga.png',
  'santo tomas': '/logos/municipalities/pampanga/sto-tomas/Flag_of_Santo_Tomas,_Pampanga.png',
  'santo-tomas': '/logos/municipalities/pampanga/sto-tomas/Flag_of_Santo_Tomas,_Pampanga.png',
  'sto tomas': '/logos/municipalities/pampanga/sto-tomas/Flag_of_Santo_Tomas,_Pampanga.png',
  'sto-tomas': '/logos/municipalities/pampanga/sto-tomas/Flag_of_Santo_Tomas,_Pampanga.png',
  sasmuan: '/logos/municipalities/pampanga/sasmuan/Sasmuan.jpg',

  // ==========================================
  // TARLAC PROVINCE
  // ==========================================
  anao: '/logos/municipalities/tarlac/anao/Anao_Tarlac.png',
  bamban: '/logos/municipalities/tarlac/bamban/Bamban_Tarlac.png',
  camiling: '/logos/municipalities/tarlac/camiling/Camiling_Tarlac.png',
  capas: '/logos/municipalities/tarlac/capas/Capas_Tarlac.png',
  concepcion: '/logos/municipalities/tarlac/concepcion/Seal_-_Concepcion_Tarlac_SVG.svg.png',
  gerona: '/logos/municipalities/tarlac/gerona/Gerona_Tarlac.png',
  'la paz': '/logos/municipalities/tarlac/la-paz/La_Paz_Tarlac.png',
  'la-paz': '/logos/municipalities/tarlac/la-paz/La_Paz_Tarlac.png',
  mayantoc: '/logos/municipalities/tarlac/mayantoc/Mayantoc_Tarlac.png',
  moncada: '/logos/municipalities/tarlac/moncada/Moncada_Tarlac.png',
  paniqui: '/logos/municipalities/tarlac/paniqui/Paniqui_Tarlac.png',
  pura: '/logos/municipalities/tarlac/pura/Pura_Tarlac.png',
  'san clemente': '/logos/municipalities/tarlac/san-clemente/San_Clemente_Tarlac.png',
  'san-clemente': '/logos/municipalities/tarlac/san-clemente/San_Clemente_Tarlac.png',
  'san manuel': '/logos/municipalities/tarlac/san-manuel/San_Manuel_Tarlac.png',
  'san-manuel': '/logos/municipalities/tarlac/san-manuel/San_Manuel_Tarlac.png',
  'santa ignacia': '/logos/municipalities/tarlac/santa-ignacia/Santa_Ignacia_Tarlac.png',
  'santa-ignacia': '/logos/municipalities/tarlac/santa-ignacia/Santa_Ignacia_Tarlac.png',
  'tarlac city': '/logos/municipalities/tarlac/city-of-tarlac/Tarlac_Province_Seal.svg.png',
  'tarlac-city': '/logos/municipalities/tarlac/city-of-tarlac/Tarlac_Province_Seal.svg.png',
  'city of tarlac': '/logos/municipalities/tarlac/city-of-tarlac/Tarlac_Province_Seal.svg.png',
  'city-of-tarlac': '/logos/municipalities/tarlac/city-of-tarlac/Tarlac_Province_Seal.svg.png',
  victoria: '/logos/municipalities/tarlac/victoria/Victoria_Tarlac.png',

  // ==========================================
  // ZAMBALES PROVINCE
  // ==========================================
  botolan: '/logos/municipalities/zambales/botolan/Ph_seal_zambales_botolan.png',
  cabangan: '/logos/municipalities/zambales/cabangan/Cabangan_Zambales_seal.png',
  candelaria: '/logos/municipalities/zambales/candelaria/Candelaria_Zambales_Seal.png',
  castillejos: '/logos/municipalities/zambales/castillejos/Castillejos_Zambales_seal.png',
  iba: '/logos/municipalities/zambales/iba/Iba_Zambales_seal.png',
  masinloc: '/logos/municipalities/zambales/masinloc/Masinloc_Zambales_seal.png',
  olongapo: '/logos/municipalities/zambales/city-of-olongapo/Olongapo_Seal.png',
  'city of olongapo': '/logos/municipalities/zambales/city-of-olongapo/Olongapo_Seal.png',
  'city-of-olongapo': '/logos/municipalities/zambales/city-of-olongapo/Olongapo_Seal.png',
  palauig: '/logos/municipalities/zambales/palauig/Palauig_Zambales_seal.png',
  'san antonio zambales': '/logos/municipalities/zambales/san-antonio/SanAntonio,102Zambalesjf.png',
  'san-antonio-zambales': '/logos/municipalities/zambales/san-antonio/SanAntonio,102Zambalesjf.png',
  'san felipe': '/logos/municipalities/zambales/san-felipe/Seal San Felipe.png',
  'san-felipe': '/logos/municipalities/zambales/san-felipe/Seal San Felipe.png',
  'san marcelino': '/logos/municipalities/zambales/san-marcelino/smz-logo-256px.png',
  'san-marcelino': '/logos/municipalities/zambales/san-marcelino/smz-logo-256px.png',
  'san narciso': '/logos/municipalities/zambales/san-narciso/san-narciso-seal 256px.png',
  'san-narciso': '/logos/municipalities/zambales/san-narciso/san-narciso-seal 256px.png',
  'santa cruz': '/logos/municipalities/zambales/santa-cruz/Santa_Cruz_Zambales.png',
  'santa-cruz': '/logos/municipalities/zambales/santa-cruz/Santa_Cruz_Zambales.png',
  'sta cruz': '/logos/municipalities/zambales/santa-cruz/Santa_Cruz_Zambales.png',
  'sta-cruz': '/logos/municipalities/zambales/santa-cruz/Santa_Cruz_Zambales.png',
  subic: '/logos/municipalities/zambales/subic/subic seal 256px.png',
}

export function getProvinceSealSrc(province?: string): string | null {
  const key = normalize(province)
  const slug = provinceSlugMap[key] || provinceSlugMap[slugify(key)]
  if (!slug) return null
  return `/logos/provinces/${slug}.png`
}

export function getMunicipalitySealSrc(municipality?: string): string | null {
  const raw = normalize(municipality)
  const candidates = [raw, slugify(raw)]
  for (const c of candidates) {
    if (c && municipalitySeals[c]) return municipalitySeals[c]
  }
  return null
}

/**
 * Returns the best seal available:
 * - municipality seal if known (e.g., Masinloc)
 * - otherwise province seal
 * - otherwise a safe fallback (Zambales province seal)
 */
export function getBestRegion3Seal(params: {
  municipality?: string
  province?: string
  fallbackProvince?: string
}): Region3Seal {
  // First try province-qualified lookup if province is provided
  let municipalitySrc: string | null = null
  if (params.municipality && params.province) {
    const provSlug = provinceSlugMap[normalize(params.province)] || slugify(params.province)
    const munRaw = normalize(params.municipality)
    const munSlug = slugify(params.municipality)
    // Try province-qualified keys first
    const qualifiedCandidates = [
      `${munRaw} ${provSlug}`,
      `${munSlug}-${provSlug}`,
    ]
    for (const c of qualifiedCandidates) {
      if (c && municipalitySeals[c]) {
        municipalitySrc = municipalitySeals[c]
        break
      }
    }
  }
  
  // Fall back to generic lookup if province-qualified didn't work
  if (!municipalitySrc) {
    municipalitySrc = getMunicipalitySealSrc(params.municipality)
  }
  
  if (municipalitySrc) {
    const name = (params.municipality || '').trim() || 'Municipality'
    return { src: municipalitySrc, alt: `${name} Seal`, kind: 'municipality' }
  }

  const inferredProvince = params.province || deriveProvinceFromMunicipality(params.municipality) || undefined
  const provinceSrc = getProvinceSealSrc(inferredProvince)
  if (provinceSrc) {
    const name = (inferredProvince || '').trim() || 'Province'
    return { src: provinceSrc, alt: `${name} Seal`, kind: 'province' }
  }

  const fallbackProvince = params.fallbackProvince || 'zambales'
  const fallbackSrc = getProvinceSealSrc(fallbackProvince) || '/logos/provinces/zambales.png'
  return { src: fallbackSrc, alt: 'Region 3 Seal', kind: 'fallback' }
}
