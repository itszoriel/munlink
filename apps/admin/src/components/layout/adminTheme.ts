import type { CSSProperties } from 'react'

export type AdminThemeName = 'super' | 'provincial' | 'municipal' | 'barangay'

type AdminThemeVars = CSSProperties & Record<`--${string}`, string>

export const adminThemes: Record<AdminThemeName, AdminThemeVars> = {
  super: {
    '--admin-accent-from': '#7c3aed',
    '--admin-accent-to': '#a855f7',
    '--admin-accent-50': '#f5f3ff',
    '--admin-accent-100': '#ede9fe',
    '--admin-accent-200': '#ddd6fe',
    '--admin-accent-600': '#7c3aed',
    '--admin-accent-700': '#6d28d9',
    '--admin-accent-shadow': 'rgba(124, 58, 237, 0.35)',
    '--color-primary': '#7c3aed',
    '--color-primary-hover': '#6d28d9',
    '--color-primary-light': '#ede9fe',
    '--ring': '#7c3aed',
  },
  provincial: {
    '--admin-accent-from': '#4f46e5',
    '--admin-accent-to': '#6366f1',
    '--admin-accent-50': '#eef2ff',
    '--admin-accent-100': '#e0e7ff',
    '--admin-accent-200': '#c7d2fe',
    '--admin-accent-600': '#4f46e5',
    '--admin-accent-700': '#4338ca',
    '--admin-accent-shadow': 'rgba(79, 70, 229, 0.35)',
    '--color-primary': '#4f46e5',
    '--color-primary-hover': '#4338ca',
    '--color-primary-light': '#e0e7ff',
    '--ring': '#4f46e5',
  },
  municipal: {
    '--admin-accent-from': '#06b6d4',
    '--admin-accent-to': '#0ea5e9',
    '--admin-accent-50': '#ecfeff',
    '--admin-accent-100': '#cffafe',
    '--admin-accent-200': '#a5f3fc',
    '--admin-accent-600': '#0891b2',
    '--admin-accent-700': '#0e7490',
    '--admin-accent-shadow': 'rgba(6, 182, 212, 0.35)',
    '--color-primary': '#0891b2',
    '--color-primary-hover': '#0e7490',
    '--color-primary-light': '#cffafe',
    '--ring': '#0891b2',
  },
  barangay: {
    '--admin-accent-from': '#10b981',
    '--admin-accent-to': '#059669',
    '--admin-accent-50': '#ecfdf5',
    '--admin-accent-100': '#d1fae5',
    '--admin-accent-200': '#a7f3d0',
    '--admin-accent-600': '#059669',
    '--admin-accent-700': '#047857',
    '--admin-accent-shadow': 'rgba(16, 185, 129, 0.35)',
    '--color-primary': '#059669',
    '--color-primary-hover': '#047857',
    '--color-primary-light': '#d1fae5',
    '--ring': '#059669',
  },
} as const
