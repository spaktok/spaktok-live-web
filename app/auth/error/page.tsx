import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
        <span className="text-2xl">!</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Die Anmeldung konnte nicht abgeschlossen werden</h1>
        <p className="text-sm text-muted-foreground max-w-xs text-balance">
          Der Link ist abgelaufen oder ungültig. Versuche, dich erneut anzumelden.
        </p>
      </div>
      <Button asChild className="rounded-2xl h-12 px-8">
        <Link href="/">Zurück zur Anmeldung</Link>
      </Button>
    </div>
  )
}
