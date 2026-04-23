/**
 * Aceternity-inspired Background Gradient wrapper.
 * Props match the official API: children, className, containerClassName, animate.
 * Uses cyan → indigo palette. Wraps content with a soft animated glow border.
 */
export default function BackgroundGradient({
  children,
  className = '',
  containerClassName = '',
  animate = true,
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${containerClassName}`}>
      {/* Animated gradient wash */}
      <div
        className={`pointer-events-none absolute -inset-px rounded-2xl opacity-80 ${
          animate ? 'motion-safe:animate-hp-drift' : ''
        }`}
        style={{
          background:
            'linear-gradient(130deg, rgba(34,211,238,0.18) 0%, rgba(129,140,248,0.14) 40%, rgba(9,9,11,0) 65%, rgba(34,211,238,0.07) 100%)',
          backgroundSize: '200% 200%',
        }}
      />
      {/* Subtle top highlight */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent rounded-2xl ${className}`}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
