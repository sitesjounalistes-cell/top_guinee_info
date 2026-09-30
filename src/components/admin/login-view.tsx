'use client'
// Écran de connexion back-office (§7.2)
import { useState } from 'react'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import type { TgUser } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, LogOut, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export function LoginView({ onLoggedIn, onExitToSite }: {
  onLoggedIn: (user: TgUser) => void
  onExitToSite: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre e-mail et votre mot de passe.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Adresse e-mail invalide.')
      return
    }
    setBusy(true)
    try {
      const { user } = await adminApi.login(email.trim(), password)
      toast.success(`Bienvenue, ${user.name} !`, { description: 'Connexion réussie au cockpit éditorial.' })
      onLoggedIn(user)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      if (/lock|verrou/i.test(msg)) setError(msg)
      else if (/credenti|identifi|invalid|401|unauthorized/i.test(msg)) setError('Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.')
      else setError(msg || 'Connexion impossible. Réessayez dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tg-navy-dark via-tg-navy to-tg-navy-light flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Décor drapeau guinéen */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex" aria-hidden>
        <div className="flex-1 bg-tg-red" />
        <div className="flex-1 bg-tg-yellow" />
        <div className="flex-1 bg-tg-green" />
      </div>
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-tg-red/10 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-tg-green/10 blur-3xl pointer-events-none" aria-hidden />

      <button
        onClick={onExitToSite}
        className="absolute top-5 right-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-tg-yellow transition-colors"
      >
        <LogOut size={15} className="rotate-180" /> Retour au site
      </button>

      <main className="w-full max-w-md relative z-10">
        {/* Logo & marque */}
        <div className="flex flex-col items-center mb-8 tg-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-2xl flex items-center justify-center overflow-hidden mb-4">
            {/* Emblème officiel : carte de la Guinée tricolore */}
            <img src="/brand/logo-map.png" alt="Logo Topguinee.info" className="w-[70px] h-[70px] object-contain" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
            Topguinee<span className="text-tg-red">.</span><span className="text-tg-yellow">info</span>
          </h1>
          <p className="text-zinc-300 text-sm mt-1.5 flex items-center gap-2">
            <span className="tg-flag-stripe" aria-hidden><i /></span>
            L&apos;information au-delà du factuel
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 tg-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-tg-red/10 text-tg-red flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-bold text-tg-navy text-lg leading-tight">Cockpit éditorial</h2>
              <p className="text-xs text-muted-foreground">Espace réservé à la rédaction</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Adresse e-mail</Label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <Input
                  id="login-email" type="email" autoComplete="email" autoFocus
                  placeholder="prenom@topguinee.info"
                  className="pl-9 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Mot de passe</Label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <Input
                  id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="••••••••••"
                  className="pl-9 pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-tg-navy transition-colors"
                  aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-tg-red/30 bg-tg-red/5 text-tg-red text-sm px-3.5 py-2.5 flex items-start gap-2">
                <Lock size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit" disabled={busy}
              className="w-full h-11 bg-tg-red hover:bg-tg-red-dark text-white font-semibold text-[15px] rounded-xl"
            >
              {busy ? (<><Loader2 size={16} className="animate-spin" /> Connexion…</>) : 'Se connecter'}
            </Button>
          </form>

        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          © {new Date().getFullYear()} Topguinee.info — Toute reproduction sans autorisation est interdite.
        </p>
      </main>
    </div>
  )
}
