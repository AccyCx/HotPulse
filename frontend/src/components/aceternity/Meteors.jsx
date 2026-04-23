import { useEffect, useState } from 'react'

/**
 * Aceternity UI — Meteors
 * 直接用 style.animation 驱动，不依赖 Tailwind 类名生成。
 * Props: number (default 20), className
 */
export default function Meteors({ number = 20, className = '' }) {
  const [meteors, setMeteors] = useState([])

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        // 随机分布在容器宽度范围内
        left: Math.floor(Math.random() * 100),   // % of container width
        top: Math.floor(Math.random() * 40) - 5, // % slightly above top
        delay: Math.random() * 8,                // seconds
        duration: Math.floor(Math.random() * 8 + 5), // 5-13s
        width: Math.floor(Math.random() * 100 + 60), // px
        opacity: Math.random() * 0.5 + 0.5,
      }))
    )
  }, [number])

  return (
    <>
      {meteors.map(m => (
        <span
          key={m.id}
          aria-hidden
          className={className}
          style={{
            position: 'absolute',
            top: `${m.top}%`,
            left: `${m.left}%`,
            display: 'block',
            opacity: m.opacity,
            // 静止时已旋转好方向
            transform: 'rotate(215deg)',
            animation: `meteor ${m.duration}s linear ${m.delay}s infinite`,
          }}
        >
          {/* 流星尾巴 */}
          <span
            style={{
              display: 'block',
              height: '1px',
              width: `${m.width}px`,
              borderRadius: '9999px',
              background:
                'linear-gradient(90deg, rgba(34,211,238,0.9) 0%, rgba(129,140,248,0.6) 40%, transparent 100%)',
            }}
          />
          {/* 流星头部光点 */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#67e8f9',
              boxShadow: '0 0 8px 3px rgba(34,211,238,0.7)',
            }}
          />
        </span>
      ))}
    </>
  )
}
