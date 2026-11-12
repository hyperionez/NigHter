type BrandMarkProps = {
  size?: number
  color?: string
}

const TIERS = [
  { min: 96, strokeWidth: 5, dot: 4.2 },
  { min: 40, strokeWidth: 5, dot: 4.4 },
  { min: 24, strokeWidth: 4.8, dot: 5.2 },
  { min: 0, strokeWidth: 4.4, dot: 5.8 },
]

export function BrandMark({ size = 20, color = 'currentColor' }: BrandMarkProps) {
  const tier = TIERS.find((t) => size >= t.min) ?? TIERS[TIERS.length - 1]

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="16"
        stroke={color}
        strokeWidth={tier.strokeWidth}
        strokeDasharray="76 24.5"
        strokeDashoffset="12"
        transform="rotate(-90 24 24)"
      />
      <circle cx="40" cy="24" r={tier.dot} fill={color} />
      <circle cx="24" cy="40" r={tier.dot} fill={color} />
    </svg>
  )
}
