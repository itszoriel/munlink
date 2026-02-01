import { motion } from 'framer-motion'

type Props = {
  backgroundUrl: string
  title: string
  subtitle?: string
}

export default function Hero({ backgroundUrl, title, subtitle }: Props) {
  return (
    <section className="relative h-[50vh] min-h-[360px] w-full overflow-hidden">
      <img src={backgroundUrl} alt="hero" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white text-fluid-6xl font-serif font-semibold drop-shadow"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/90 mt-4 max-w-3xl text-fluid-xl"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>
    </section>
  )
}


