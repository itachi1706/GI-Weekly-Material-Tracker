/**
 * Shared rarity selector — every entity (Materials, Outfits, Weapons, Characters) shows rarity as
 * stars-only, never a bare number. `options` is the set of valid values for that entity/category
 * (e.g. [4, 5] for outfits, [1..5] for weapons), rendered as one `★`-repeated option each.
 */
export function RaritySelect({
  value, onChange, options, disabled
}: {
  value: string
  onChange: (v: string) => void
  options: number[]
  disabled?: boolean
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((n) => (
        <option key={n} value={String(n)}>{'★'.repeat(n)}</option>
      ))}
    </select>
  )
}
