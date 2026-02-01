import type { ReactNode } from 'react'
import { Modal as SharedModal } from '@munlink/ui'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ isOpen, onClose, title, children, footer }: Props) {
  return (
    <SharedModal open={isOpen} onOpenChange={(o) => { if (!o) onClose() }} title={title} footer={footer}>
      {children}
    </SharedModal>
  )
}


