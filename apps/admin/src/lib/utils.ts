// Utility helpers shared across admin front-end
// Tailwind-friendly class name merger (keeps simple to avoid extra deps)
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ')
}

