'use client'
// Pages statiques éditables (À propos / Mentions légales / Confidentialité)
// + page Contact : coordonnées, réseaux sociaux et formulaire avec honeypot.
// Design « premium éditorial » : en-tête kicker + serif + filet navy court,
// corps en prose serif avec lettrine, formulaire aux coins nets.

import { useState } from 'react'
import { publicApi } from '@/lib/api'
import type { ContactChannel, SocialLink } from '@/lib/types'
import { safeHttpUrl } from '@/lib/sanitize'
import { Breadcrumb, RichText, SocialIcon } from '@/components/tg/shared'
import { EmptyState, ErrorState, LinesSkeleton, useAsyncData } from './common'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Loader2, Mail, Phone, MessageCircle, MapPin, Info, Send,
} from 'lucide-react'

// ─── En-tête de page premium (commun aux pages statiques + contact) ──

const PAGE_KICKERS: Record<string, string> = {
  about: 'Le média',
  legal: 'Informations légales',
  privacy: 'Vos données',
}

function PageHero({ title, kicker }: { title: string; kicker: string }) {
  return (
    <header className="tg-fade-up">
      <p className="tg-kicker text-tg-red flex items-center gap-2">
        <span className="w-2 h-2 rotate-45 bg-tg-red shrink-0" aria-hidden />
        {kicker}
      </p>
      <h1 className="mt-3 font-display font-bold text-[28px] md:text-[36px] tracking-tight text-tg-navy leading-[1.1]">
        {title}
      </h1>
      <div className="mt-5 w-16 border-b-2 border-tg-navy" aria-hidden />
    </header>
  )
}

// ─── Page éditable générique (about / legal / privacy) ───────────────

export function StaticPageView({ pageKey, fallbackTitle }: { pageKey: string; fallbackTitle: string }) {
  const { data, loading, error, reload } = useAsyncData(() => publicApi.page(pageKey), pageKey)
  const title = data?.page?.title || fallbackTitle

  return (
    <div className="tg-container py-8 md:py-12">
      <div className="max-w-[760px] mx-auto">
        <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: title }]} />
        <div className="mt-8">
          {loading ? (
            <div className="space-y-5" aria-busy="true" aria-label="Chargement">
              <Skeleton className="h-9 w-64" />
              <div className="pt-3"><LinesSkeleton lines={8} /></div>
            </div>
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : !data?.page?.content ? (
            <EmptyState
              icon={<Info size={22} aria-hidden />}
              title="Contenu en préparation"
              description="Cette page sera bientôt complétée par la rédaction."
            />
          ) : (
            <>
              <PageHero title={title} kicker={PAGE_KICKERS[pageKey] || 'Topguinee.info'} />
              <div className="mt-9 border-t border-zinc-200 pt-8 tg-fade-up">
                <RichText html={data.page.content} className="tg-dropcap" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page Contact ─────────────────────────────────────────────────────

const CONTACT_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  address: MapPin,
  other: Info,
}

function channelHref(c: ContactChannel): string | null {
  if (c.type === 'email') return `mailto:${c.value}`
  if (c.type === 'phone') return `tel:${c.value.replace(/\s/g, '')}`
  if (c.type === 'whatsapp') return `https://wa.me/${c.value.replace(/\D/g, '')}`
  return null
}

// Rangée de coordonnée : cercle bordé + label kicker + valeur semibold navy
function ContactRow({ c }: { c: ContactChannel }) {
  const Icon = CONTACT_ICONS[c.type] || Info
  const href = channelHref(c)
  const cls = 'group flex items-center gap-4 rounded-sm border border-zinc-200 bg-white px-4 py-3.5 transition-colors duration-300 hover:border-tg-navy'
  const inner = (
    <>
      <span className="w-11 h-11 rounded-full border border-zinc-200 text-tg-navy flex items-center justify-center shrink-0 transition-colors duration-300 group-hover:bg-tg-navy group-hover:border-tg-navy group-hover:text-white">
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="tg-kicker text-[10px] text-zinc-400 block truncate">{c.label}</span>
        <span className="block text-[14.5px] font-semibold text-tg-navy break-words">{c.value}</span>
      </span>
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target={c.type === 'whatsapp' ? '_blank' : undefined}
        rel="noopener noreferrer"
        className={cls}
      >
        {inner}
      </a>
    )
  }
  return <div className={cls}>{inner}</div>
}

function ColonneTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="tg-kicker text-zinc-500 flex items-center gap-2 mb-4">
      <span className="w-2 h-2 rotate-45 bg-tg-yellow shrink-0" aria-hidden />
      {children}
    </p>
  )
}

// Champ de formulaire : label kicker + enfants + message d'erreur
function Field({ label, htmlFor, required, error, children }: {
  label: string; htmlFor: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="tg-kicker text-zinc-500">
        {label} {required && <span className="text-tg-red">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-tg-red" role="alert">{error}</p>}
    </div>
  )
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

export function ContactView() {
  const { data, loading, error, reload } = useAsyncData(() => publicApi.settings(), 'settings-public')
  const contacts = (data?.contacts || []).filter((c) => c.isActive).sort((a, b) => a.order - b.order)
  const socials = (data?.socials || []).filter((s) => s.isActive).sort((a, b) => a.order - b.order)

  // Formulaire
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [k]: '' }))
  }

  const validate = () => {
    const fe: Record<string, string> = {}
    if (!form.name.trim()) fe.name = 'Veuillez indiquer votre nom.'
    if (!form.email.trim()) fe.email = 'Veuillez indiquer votre e-mail.'
    else if (!EMAIL_RE.test(form.email.trim())) fe.email = 'Adresse e-mail invalide.'
    if (!form.subject.trim()) fe.subject = 'Veuillez préciser un sujet.'
    if (!form.message.trim()) fe.message = 'Veuillez écrire votre message.'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    // Honeypot rempli → probablement un robot : on fait semblant sans envoyer
    if (form.website) {
      toast.success('Message envoyé ! L\'équipe vous répondra rapidement')
      setForm({ name: '', email: '', subject: '', message: '', website: '' })
      return
    }
    setSending(true)
    try {
      await publicApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        honeypot: form.website,
      })
      toast.success('Message envoyé ! L\'équipe vous répondra rapidement')
      setForm({ name: '', email: '', subject: '', message: '', website: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de l\'envoi. Merci de réessayer.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="tg-container py-8 md:py-12">
      <div className="max-w-[1100px] mx-auto">
        <PageHero title="Contact" kicker="La rédaction" />
        <p className="mt-5 text-zinc-500 text-sm md:text-[15px] leading-relaxed max-w-2xl tg-fade-up">
          Une information à nous transmettre ? Une question, une suggestion, un partenariat ?
          L&apos;équipe de la rédaction vous lit attentivement et vous répond au plus vite.
        </p>

        {loading ? (
          <ContactSkeleton />
        ) : error ? (
          <div className="mt-10"><ErrorState onRetry={reload} /></div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-10 mt-10">
            {/* ── Colonne gauche : coordonnées + réseaux ─────────── */}
            <div className="lg:col-span-2 space-y-8 tg-fade-up">
              {contacts.length > 0 ? (
                <div>
                  <ColonneTitle>Nos coordonnées</ColonneTitle>
                  <div className="space-y-3">
                    {contacts.map((c) => <ContactRow key={c.id} c={c} />)}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Mail size={22} aria-hidden />}
                  title="Coordonnées en cours de mise à jour"
                  description="Écrivez-nous via le formulaire ci-contre en attendant."
                />
              )}

              {socials.length > 0 && (
                <div>
                  <ColonneTitle>Réseaux sociaux</ColonneTitle>
                  <div className="flex flex-wrap gap-2.5">
                    {socials.map((s: SocialLink) => (
                      <a
                        key={s.id}
                        href={safeHttpUrl(s.url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Nous suivre sur ${s.platform}`}
                        title={s.platform}
                        className="w-11 h-11 rounded-full border border-zinc-200 bg-white text-tg-navy hover:bg-tg-yellow hover:border-tg-yellow hover:-translate-y-0.5 flex items-center justify-center transition-all duration-300"
                      >
                        <SocialIcon platform={s.platform} size={17} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite : formulaire ────────────────────── */}
            <form
              onSubmit={submit}
              noValidate
              className="lg:col-span-3 relative rounded-sm border border-zinc-200 bg-white p-5 md:p-7 space-y-5 tg-fade-up"
              aria-label="Formulaire de contact"
            >
              {/* En-tête du formulaire */}
              <div className="pb-4 border-b border-zinc-200">
                <p className="tg-kicker text-zinc-400">Formulaire</p>
                <h2 className="mt-1 font-display font-bold text-xl text-tg-navy tracking-tight">Écrivez-nous</h2>
              </div>

              {/* Honeypot anti-spam (invisible pour les humains) */}
              <div className="absolute opacity-0 pointer-events-none -z-10" aria-hidden="true">
                <label htmlFor="tg-website">Site web</label>
                <input
                  id="tg-website"
                  name="website"
                  type="text"
                  value={form.website}
                  onChange={set('website')}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Votre nom" htmlFor="ct-name" required error={fieldErrors.name}>
                  <Input
                    id="ct-name"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Ex : Mamadou Diallo"
                    aria-invalid={!!fieldErrors.name}
                    className="h-11 rounded-sm border-zinc-300 focus-visible:border-tg-navy focus-visible:ring-0"
                  />
                </Field>
                <Field label="Votre e-mail" htmlFor="ct-email" required error={fieldErrors.email}>
                  <Input
                    id="ct-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="vous@exemple.com"
                    aria-invalid={!!fieldErrors.email}
                    className="h-11 rounded-sm border-zinc-300 focus-visible:border-tg-navy focus-visible:ring-0"
                  />
                </Field>
              </div>

              <Field label="Sujet" htmlFor="ct-subject" required error={fieldErrors.subject}>
                <Input
                  id="ct-subject"
                  value={form.subject}
                  onChange={set('subject')}
                  placeholder="Ex : Suggestion d'article"
                  aria-invalid={!!fieldErrors.subject}
                  className="h-11 rounded-sm border-zinc-300 focus-visible:border-tg-navy focus-visible:ring-0"
                />
              </Field>

              <Field label="Votre message" htmlFor="ct-message" required error={fieldErrors.message}>
                <Textarea
                  id="ct-message"
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Écrivez-nous… Plus votre message est précis, plus vite nous pourrons vous répondre."
                  rows={6}
                  aria-invalid={!!fieldErrors.message}
                  className="rounded-sm border-zinc-300 min-h-[140px] focus-visible:border-tg-navy focus-visible:ring-0 resize-y"
                />
              </Field>

              <Button
                type="submit"
                disabled={sending}
                className="w-full h-12 rounded-sm bg-tg-navy hover:bg-tg-red text-white font-semibold tracking-wide min-h-[44px] transition-colors duration-300"
              >
                {sending ? <Loader2 size={18} className="animate-spin mr-2" aria-hidden /> : <Send size={16} className="mr-2" aria-hidden />}
                {sending ? 'Envoi en cours…' : 'Envoyer le message'}
              </Button>
              <p className="text-[11px] text-zinc-400 text-center pt-1">
                Vos données ne sont utilisées que pour vous répondre — jamais partagées.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// Squelette de chargement : rangées de coordonnées + panneau formulaire
function ContactSkeleton() {
  return (
    <div className="grid lg:grid-cols-5 gap-10 mt-10" aria-busy="true" aria-label="Chargement">
      <div className="lg:col-span-2 space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-sm border border-zinc-200 bg-white p-4">
            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-3 rounded-sm border border-zinc-200 bg-white p-5 md:p-7" aria-hidden>
        <LinesSkeleton lines={6} />
      </div>
    </div>
  )
}
