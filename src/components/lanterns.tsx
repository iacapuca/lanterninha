// Scores are counted in flashlights (🔦), the usher's lantern, Letterboxd-style half steps.

const SCALE = [1, 2, 3, 4, 5] as const

function Flashlight({ fill }: { fill: 0 | 0.5 | 1 }) {
  return (
    <span className="flashlight" data-fill={fill} aria-hidden="true">
      <span className="flashlight-off">🔦</span>
      {fill > 0 && (
        <span className="flashlight-on" style={{ width: `${fill * 100}%` }}>
          🔦
        </span>
      )}
    </span>
  )
}

export function Lanterns({ rating, size = 16 }: { rating: number | null; size?: number }) {
  const value = rating ?? 0
  return (
    <span
      className="lanterns"
      style={{ fontSize: size }}
      role="img"
      aria-label={rating == null ? 'Sem avaliações' : `${rating} de 5 lanternas`}
    >
      {SCALE.map((n) => (
        <Flashlight key={n} fill={value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0} />
      ))}
    </span>
  )
}

/** Interactive half-step picker: each flashlight has two hit areas (left/right half). */
export function LanternPicker({
  value,
  onChange,
  name,
}: {
  value: number
  onChange: (rating: number) => void
  name: string
}) {
  return (
    <fieldset className="lantern-picker">
      <legend className="sr-only">Nota geral</legend>
      <Lanterns rating={value} size={36} />
      <div className="lantern-picker-hits">
        {SCALE.flatMap((n) => [n - 0.5, n]).map((n) => (
          <label key={n} title={`${n} 🔦`}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span className="sr-only">{n} lanternas</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
