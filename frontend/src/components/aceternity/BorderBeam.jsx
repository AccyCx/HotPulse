/**
 * Aceternity-style Border Beam.
 * A slow-rotating conic gradient creates a "light sweeping around the border" effect.
 * One composited layer; respects prefers-reduced-motion via Tailwind.
 */
export default function BorderBeam({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-px ${className}`}>
      {/* Rotating beam */}
      <span aria-hidden className="pointer-events-none absolute inset-0 block overflow-hidden rounded-2xl">
        <span
          className="absolute -inset-full block motion-safe:animate-hp-beam opacity-60 motion-reduce:opacity-0"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0 20%, rgba(34,211,238,0.7) 38%, rgba(129,140,248,0.55) 55%, transparent 70%)',
          }}
        />
      </span>
      {/* Inner surface */}
      <div className="relative z-[1] m-[1px] rounded-[15px] bg-hp-card backdrop-blur-md">
        {children}
      </div>
    </div>
  )
}
