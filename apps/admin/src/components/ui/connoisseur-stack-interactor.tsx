import { cn } from '@/lib/utils'
import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

export interface MenuItem {
  num: string
  name: string
  clipId: string
  image: string
  onSelect?: () => void
}

const defaultItems: MenuItem[] = [
  {
    num: '01',
    name: 'Civic Services',
    clipId: 'clip-original',
    image:
      'https://images.unsplash.com/photo-1484882918957-e9ba0150f64f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    num: '02',
    name: 'Community Outreach',
    clipId: 'clip-hexagons',
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    num: '03',
    name: 'Local Innovation',
    clipId: 'clip-pixels',
    image:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    num: '04',
    name: 'Crisis Response',
    clipId: 'clip-stripes',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
]

export function ConnoisseurStackInteractor({
  items = defaultItems,
  className,
}: {
  items?: MenuItem[]
  className?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<SVGImageElement>(null)
  const mainGroupRef = useRef<SVGGElement>(null)
  const masterTl = useRef<gsap.core.Timeline | null>(null)

  const createLoop = (index: number) => {
    const item = items[index]
    const selector = `#${item.clipId} .path`

    if (masterTl.current) masterTl.current.kill()

    if (imageRef.current) imageRef.current.setAttribute('href', item.image)
    if (mainGroupRef.current) mainGroupRef.current.setAttribute('clip-path', `url(#${item.clipId})`)

    gsap.set(selector, { scale: 0, transformOrigin: '50% 50%' })

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 })

    tl.to(selector, {
      scale: 1,
      duration: 0.8,
      stagger: { amount: 0.4, from: 'random' },
      ease: 'expo.out',
    })
      .to(selector, {
        scale: 1.05,
        duration: 1.5,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
        stagger: { amount: 0.2, from: 'center' },
      })
      .to(selector, {
        scale: 0,
        duration: 0.6,
        stagger: { amount: 0.3, from: 'edges' },
        ease: 'expo.in',
      })

    masterTl.current = tl
  }

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      createLoop(0)
    }, containerRef)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleItemHover = (index: number) => {
    if (index === activeIndex) return
    setActiveIndex(index)
    createLoop(index)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col md:flex-row items-center justify-between min-h-[380px] md:min-h-[440px] w-full p-4 md:p-8 overflow-hidden transition-colors duration-500',
        'bg-slate-900 text-white',
        className,
      )}
    >
      <div className="z-20 w-full md:w-1/2">
        <nav>
          <ul className="flex flex-col gap-8 md:gap-10">
            {items.map((item, index) => (
              <li
                key={item.num}
                onMouseEnter={() => handleItemHover(index)}
                onClick={item.onSelect}
                className="group cursor-pointer"
              >
                <div className="flex items-start gap-6">
                  <span
                    className={cn(
                      'text-2xl md:text-3xl font-bold transition-all duration-500 mt-1 md:mt-2',
                      activeIndex === index ? 'text-orange-400 scale-110' : 'text-slate-400',
                    )}
                  >
                    {item.num}
                  </span>

                  <h2
                    className={cn(
                      'text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9] transition-all duration-700',
                      activeIndex === index
                        ? 'text-white opacity-100 translate-x-4'
                        : 'opacity-30 translate-x-0 text-white/30 [text-stroke:1px_#94a3b8] [-webkit-text-stroke:1px_#94a3b8]',
                    )}
                  >
                    {item.name.split(' ')[0]}
                    <br />
                    {item.name.split(' ')[1]}
                  </h2>
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="relative w-full md:w-1/2 flex justify-center items-center mt-10 md:mt-0">
        <div className="absolute w-[110%] h-[110%] bg-orange-500/10 dark:bg-orange-600/5 blur-[100px] rounded-full transition-opacity duration-1000" />

        <svg
          viewBox="0 0 500 500"
          className="w-[100%] max-w-[500px] h-auto z-10 drop-shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
          <defs>
            <clipPath id="clip-original">
              <path
                className="path"
                d="M480.6,235H19.4c-6,0-10.8-4.9-10.8-10.8v-9.5c0-6,4.9-10.8,10.8-10.8h461.1c6,0,10.8,4.9,10.8,10.8v9.5C491.4,230.2,486.6,235,480.6,235z"
              />
              <path
                className="path"
                d="M483.1,362.4H16.9c-4.6,0-8.3-3.7-8.3-8.3v-1.8c0-4.6,3.7-8.3,8.3-8.3h466.1c4.6,0,8.3,3.7,8.3,8.3v1.8C491.4,358.7,487.7,362.4,483.1,362.4z"
              />
              <path
                className="path"
                d="M460.3,336.3H39.7c-17.2,0-31.1-13.9-31.1-31.1v-31.5c0-17.2,13.9-31.1,31.1-31.1h420.7c17.2,0,31.1-13.9,31.1-31.1v31.5C491.4,322.4,477.5,336.3,460.3,336.3z"
              />
              <path
                className="path"
                d="M459.2,196.2H40.8v-35c0-47.5,38.5-86,86-86h246.5c47.5,0,86,38.5,86,86V196.2z"
              />
              <path
                className="path"
                d="M441.9,424.9H58.1c-9.6,0-17.3-7.8-17.3-17.3v-37.4h418.5v37.4C459.2,417.1,451.5,424.9,441.9,424.9z"
              />
            </clipPath>

            <clipPath id="clip-hexagons">
              <rect className="path" x="20" y="20" width="200" height="280" rx="12" />
              <rect className="path" x="20" y="320" width="200" height="160" rx="12" />
              <rect className="path" x="240" y="20" width="240" height="140" rx="12" />
              <rect className="path" x="240" y="180" width="110" height="160" rx="12" />
              <rect className="path" x="370" y="180" width="110" height="160" rx="12" />
              <rect className="path" x="240" y="360" width="240" height="120" rx="12" />
            </clipPath>

            <clipPath id="clip-pixels">
              {Array.from({ length: 9 }).map((_, i) => (
                <rect
                  key={i}
                  className="path"
                  x={(i % 3) * 160 + 20}
                  y={Math.floor(i / 3) * 160 + 20}
                  width="140"
                  height="140"
                  rx="4"
                />
              ))}
            </clipPath>

            <clipPath id="clip-stripes">
              {Array.from({ length: 6 }).map((_, i) => (
                <rect key={i} className="path" x={20 + i * 80} y="20" width="60" height="460" rx="6" />
              ))}
            </clipPath>
          </defs>

          <g ref={mainGroupRef} clipPath={`url(#${items[0]?.clipId || 'clip-original'})`}>
            <image
              ref={imageRef}
              href={items[0]?.image}
              width="500"
              height="500"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        </svg>
      </div>
    </div>
  )
}

export const Component = ConnoisseurStackInteractor
