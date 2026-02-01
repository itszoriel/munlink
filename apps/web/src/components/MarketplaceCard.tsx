import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'

type Props = {
  imageUrl?: string
  title: string
  price?: string
  municipality?: string
  transactionType?: 'donate' | 'lend' | 'sell'
  href?: string
}

export default function MarketplaceCard({ imageUrl, title, price, municipality, transactionType, href }: Props) {
  const typeStyles = transactionType === 'sell'
    ? 'bg-ocean-600 text-white'
    : transactionType === 'lend'
      ? 'bg-forest-600 text-white'
      : 'bg-sunset-600 text-white'

  const Inner = (
    <Card variant="elevated" hover className="overflow-hidden group">
      <article>
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={title} loading="lazy" className="h-full w-full object-cover transform transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {municipality && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-neutral-800 shadow">{municipality}</span>
            )}
          </div>
          {transactionType && (
            <div className="absolute top-3 right-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow ${typeStyles}`}>{transactionType}</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold line-clamp-2">{title}</h3>
          {price && <div className="text-primary-600 font-semibold mt-1">{price}</div>}
        </div>
      </article>
    </Card>
  )

  if (href) {
    return (
      <Link to={href} className="block">
        {Inner}
      </Link>
    )
  }
  return Inner
}


