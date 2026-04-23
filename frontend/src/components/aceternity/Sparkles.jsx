import { useEffect, useRef, useCallback } from 'react'

/**
 * Aceternity UI — Sparkles (canvas 粒子)
 * 直接用 requestAnimationFrame 驱动，style 控制尺寸。
 *
 * 关键修复：
 *  - wrapper 不强加 `relative`，由外部 className 控制定位
 *  - canvas 通过 ResizeObserver 感知真实尺寸
 */
export default function Sparkles({
  className = '',
  id = 'sparkles-canvas',
  background = 'transparent',
  minSize = 0.4,
  maxSize = 1.4,
  speed = 1,
  particleColor = '#22d3ee',
  particleDensity = 80,
  children,
}) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const partsRef  = useRef([])

  const hexToRgb = useCallback(hex => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ], [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const [r, g, b] = hexToRgb(particleColor)

    const rebuild = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (!w || !h) return
      canvas.width  = w
      canvas.height = h
      const count = Math.max(20, Math.floor((w * h) / (10000 / particleDensity)))
      partsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * (maxSize - minSize) + minSize,
        a: Math.random(),
        da: (Math.random() * 0.01 + 0.003) * speed * (Math.random() < 0.5 ? 1 : -1),
        dx: (Math.random() - 0.5) * 0.4 * speed,
        dy: (Math.random() - 0.5) * 0.4 * speed,
      }))
    }

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      for (const p of partsRef.current) {
        p.a += p.da
        if (p.a <= 0 || p.a >= 1) p.da *= -1
        p.x = (p.x + p.dx + w) % w
        p.y = (p.y + p.dy + h) % h

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0, Math.min(1, p.a))})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(() => {
      rebuild()
    })
    ro.observe(canvas)
    rebuild()
    animRef.current = requestAnimationFrame(draw)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animRef.current)
    }
  }, [background, minSize, maxSize, speed, particleColor, particleDensity, hexToRgb])

  return (
    <div
      className={className}
      style={
        // 如果 className 不含定位，给一个默认 relative
        className.includes('absolute') || className.includes('fixed')
          ? undefined
          : { position: 'relative' }
      }
    >
      <canvas
        ref={canvasRef}
        id={id}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      {children && <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>}
    </div>
  )
}
