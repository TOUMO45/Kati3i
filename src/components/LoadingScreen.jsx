import { Loader2 } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
    </div>
  )
}