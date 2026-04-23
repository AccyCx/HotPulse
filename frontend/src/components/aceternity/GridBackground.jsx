/**
 * Full-screen ambient layer: dot grid + top aurora glow.
 * Spans the ENTIRE viewport (fixed inset-0) with NO side masks.
 * AuroraBackground component handles the animated color sweep separately.
 */
export default function GridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundColor: '#09090b' }}
    >
      {/* Fine dot grid — full viewport, no mask */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(113,113,122,0.22) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Subtle top-center ambient glow */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: '100vw',
          height: '45vh',
          background:
            'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(34,211,238,0.09) 0%, rgba(129,140,248,0.06) 50%, transparent 80%)',
        }}
      />
    </div>
  )
}
