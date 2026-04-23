/**
 * Aceternity UI — Aurora Background
 * 直接用 style.animation 驱动，不依赖 Tailwind 类名生成。
 * Props: children, className, showRadialGradient (default true)
 */
export default function AuroraBackground({
  children,
  className = '',
  showRadialGradient = true,
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Aurora animated layer */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-2px',
            backgroundImage: [
              'repeating-linear-gradient(100deg, rgba(59,130,246,0.5) 10%, rgba(139,92,246,0.4) 15%, rgba(34,211,238,0.5) 20%, rgba(16,185,129,0.3) 25%, rgba(59,130,246,0.5) 30%)',
              'repeating-linear-gradient(100deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0) 100%)',
            ].join(', '),
            backgroundSize: '300% 100%, 200% 200%',
            backgroundPosition: '50% 50%, 50% 50%',
            mixBlendMode: 'screen',
            opacity: 0.65,
            animation: 'aurora 60s linear infinite',
            willChange: 'background-position',
          }}
        />
      </div>

      {/* Radial vignette — content readable */}
      {showRadialGradient && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 65% at 50% 0%, transparent 25%, rgba(9,9,11,0.78) 80%)',
          }}
        />
      )}

      {/* Content on top */}
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
