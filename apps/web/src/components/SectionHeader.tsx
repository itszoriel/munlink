type Props = {
  title: string
  action?: React.ReactNode
  className?: string
}

export default function SectionHeader({ title, action, className }: Props) {
  return (
    <div className={(className ?? '') + ' flex items-center justify-between mb-6'}>
      <h2 className="text-fluid-3xl font-serif font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
  )
}


