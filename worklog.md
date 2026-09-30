# Worklog — Projet TOPGUINEE.INFO

Plateforme média d'information en ligne : site public (front-office) + tableau de bord (back-office).
Cahier des charges v2.0 — stocké dans /home/z/my-project/upload/Pasted Content_1790335917961.txt

## Références clés du cahier des charges (décisions d'implémentation)

- Marque : Topguinee.info — « L'information au sommet de l'actualité »
- Charte : Rouge #D21034 (accents/boutons/Flash Info), Jaune #FCD116 (À la Une), Vert #009460 (liens/confirmations), Bleu marine #14213D (typo/header/footer), Blanc #FFFFFF / Gris #F5F5F5 (fonds)
- Contact : topguinee.info@gmail.com, +224 621 62 63 18, WhatsApp +224 664 63 90 42
- Socials : Facebook facebook.com/share/189PtCYZ6j, TikTok @topguinee.info, YouTube @topguineeinfo, X/Instagram/Threads à créer
- Statuts article : DRAFT / REVIEW / PUBLISHED / UNPUBLISHED / ARCHIVED (Brouillon/En relecture/Publié/Dépublié/Archivé)
- À la Une : sélection manuelle (1 principal + N secondaires, ordre éditorial)
- Flash Info : ticker, priorité, expiration automatique, lien article optionnel
- Médias : images (upload→stockage local public/uploads avec abstraction Cloudinary), vidéos YouTube (embed par lien), audio (upload→local, abstraction Google Drive)
- Rubriques : arborescence illimitée (parent/enfant), couleur, icône, ordre, activation
- Publicité : emplacements header/footer/sidebar/in-article/intercalaire + campagnes (dates, poids/rotation, impressions/clics, annonceur)
- Back-office : dashboard, articles (éditeur WYSIWYG autosave, programmation, duplication, aperçu), à la Une, flash, rubriques, FM/émissions/épisodes, contacts & socials, messagerie, pub, stats (périodes, export CSV), paramètres, journal d'activité
- Contrainte sandbox : 1 seule route visible `/` → SPA avec routeur à hash (#/article/...), tout le reste en composants. API REST sous /api/*.
- DB : SQLite (sandbox) via Prisma — schéma portable PostgreSQL en production.
- Auth : cookie de session signé, verrouillage après 5 échecs, rôles ADMIN/EDITOR/JOURNALIST prévus.

## Contrat d'API (implémenté par l'agent 2-a, consommé par 2-b et 2-c)

### Public (GET /api/public/...)
- `GET /api/public/home` → { settings, flash[], featured:{main, secondary[]}, rubriqueBlocks[{rubrique, articles[]}], mostRead[], latestEpisodes[], latestVideos[], ads:{header,footer,intercalaire} }
- `GET /api/public/articles?rubrique=&sub=&q=&tag=&page=&limit=` → { items[], total, page, pages }
- `GET /api/public/articles/:slug` → { article (avec tags, rubrique, auteur, médias), similar[] } (incrémente les vues)
- `GET /api/public/flash` → { flash[] actives non expirées }
- `GET /api/public/emissions` → { emissions[] avec épisodes publiés }
- `GET /api/public/settings` → { settings, contacts[], socials[] }
- `GET /api/public/page/:key` → contenu page éditable (about, legal…) : { key, title, content }
- `POST /api/public/contact` { name,email,subject,message,honeypot? } → { ok }
- `POST /api/public/ads/:id/click` → { ok } (incrémente clics)
- `GET /api/public/search?q=` → même contrat que articles (alias)

### Admin (sous /api/admin/*, cookie session httpOnly `tg_session`)
- `POST /api/admin/auth/login` { email, password } → { user } + cookie (verrouillage 5 échecs/10min)
- `POST /api/admin/auth/logout` ; `GET /api/admin/auth/me` → { user } ou 401
- `GET /api/admin/overview` → { stats cartes, derniers articles, derniers messages, activité récente }
- `GET /api/admin/stats?period=day|week|month|all` → { cards, timeline[], byRubrique[], byAuthor[], topArticles[], bottomArticles[], mediaMix }
- `GET/POST /api/admin/articles` (filters: q,status,rubriqueId,page) ; `GET/PUT/DELETE /api/admin/articles/:id` ; `POST /api/admin/articles/:id/duplicate`
- `PUT /api/admin/featured` { mainId, secondaryIds[] } → met à jour À la Une
- `GET/POST /api/admin/rubriques` ; `PUT/DELETE /api/admin/rubriques/:id`
- `GET/POST /api/admin/flash` ; `PUT/DELETE /api/admin/flash/:id`
- `GET/POST /api/admin/emissions` ; `PUT/DELETE /api/admin/emissions/:id`
- `GET/POST /api/admin/episodes` ; `PUT/DELETE /api/admin/episodes/:id`
- `GET/POST /api/admin/contacts` ; `PUT/DELETE /api/admin/contacts/:id` (canaux)
- `GET/POST /api/admin/socials` ; `PUT/DELETE /api/admin/socials/:id`
- `GET /api/admin/messages` ; `PUT /api/admin/messages/:id` (isRead/isArchived) ; `DELETE`
- `GET /api/admin/ads/slots` ; `PUT /api/admin/ads/slots/:id` ; `GET/POST /api/admin/ads/campaigns` ; `PUT/DELETE /api/admin/ads/campaigns/:id` ; `GET/POST /api/admin/ads/advertisers`
- `GET/PUT /api/admin/settings` (clés : siteName, slogan, fmLabel, aboutTitle/aboutContent, legalContent, privacyContent, maintenance, seoTitle, seoDescription, seoImage, analyticsId)
- `GET /api/admin/logs?type=&userId=` → { logs[] }
- `POST /api/admin/upload` (multipart file, type=image|audio) → { url }
- Impression pub : comptée côté front via POST /api/public/ads/:id/click et param impression à la livraison.

---
Task ID: 1
Agent: Z.ai Code (orchestrateur)
Task: Fondations du projet — analyse CDC, worklog, assets, schéma DB, seed, thème, types, client API, routeur, composants partagés, module auth

Work Log:
- Analysé le cahier des charges complet (15 sections) et consigné les décisions ci-dessus
- Schéma Prisma complet (§9.2) : User, Rubrique (arborescente), Article, Tag+ArticleTag, ArticleViewLog, Media, Emission, Episode, FlashInfo, ContactChannel, SocialLink, ContactMessage, AdSlot, Advertiser, AdCampaign, SiteSetting, EditablePage, ActivityLog — poussé vers SQLite
- Seed exécuté : 15 articles FR réalistes (dont 1 brouillon, 1 en relecture, 1 programmé), 10 rubriques/sous-rubriques, 4 épisodes audio, 4 flash infos, contacts/socials/6 emplacements pub + 3 campagnes/2 annonceurs, paramètres, 3 pages éditables (about/legal/privacy), 3 messages démo, journal d'activité
- globals.css : tokens charte (--color-tg-red #D21034, tg-yellow #FCD116, tg-green #009460, tg-navy #14213D, tg-gray #F5F5F5), shadcn vars alignées (primary=navy, destructive=rouge, ring=vert), styles .tg-prose (corps d'article), animations ticker/fondu, barre de lecture, scrollbar, éditeur
- src/lib/types.ts : types TS partagés complets
- src/lib/api.ts : client API typé (publicApi + adminApi + helpers fmt/slugify/STATUS/ pickBanner + uploadFile)
- src/lib/router.tsx : routeur SPA à hash (useHashRoute, navigate, Link) — contrainte 1 seule route /
- src/lib/auth.ts (SERVEUR) : hash scrypt, sessions HMAC signées (cookie tg_session 12h), verrouillage 5 échecs/10 min, requireUser()
- src/components/tg/shared.tsx : FadeImage, ArticleCard (hero/large/medium/small/horizontal), SectionHeader, FlashTicker, AdBanner, ShareButtons, SocialIcon, StatusBadge, AudioPlayer, YouTubeEmbed + youtubeId, RichText (sanitisé), Breadcrumb, Pagination
- Seed passwords corrigés avec scrypt réel :
  * admin@topguinee.info / •••••••• (ADMIN)
  * journaliste@topguinee.info / •••••••• (JOURNALIST)
- Génération d'assets lancée : logo.png OK; couvertures/bannières en cours → /public/uploads/

Stage Summary:
- Toute la base technique est prête. AGENTS : réutilisez OBLIGATOIREMENT src/lib/api.ts (client), src/lib/types.ts, src/lib/auth.ts (serveur), src/components/tg/shared.tsx, la palette tg-* et le routeur hash.
- NE MODIFIEZ PAS : page.tsx (orchestrateur), src/lib/*, src/components/tg/shared.tsx, prisma/schema.prisma.
- Mot de passe à afficher sur l'écran de login (démo) : ••••••••
- Images référencées par URL : /uploads/cover-politique.png, cover-economie.png, cover-societe.png, cover-sport.png, cover-culture.png, cover-international.png, cover-une.png, emission-journal.png, emission-debat.png, pub-orange.png, pub-banque.png, logo.png
- Audio épisodes : /uploads/audio/sample-chronique.mp3 (fichier généré ensuite par TTS; le lecteur gère gracieusement l'absence)

---

---
Task ID: 2-a
Agent: API backend agent
Task: Implémentation de toutes les routes API (public + admin) conformément au contrat de src/lib/api.ts

Work Log:
- Lu worklog.md, prisma/schema.prisma, src/lib/auth.ts, src/lib/db.ts, src/lib/api.ts, src/lib/types.ts — contrat respecté à la lettre
- Créé src/lib/server/helpers.ts (module serveur partagé) : logAction (ActivityLog §7.11), visibleWhere (PUBLISHED + publishedAt<=now + scheduledAt nulle/échéue), articleCardInclude/toCard/toFull (mappage exact vers ArticleCardData/ArticleFull), uniqueSlugIn (suffixes -2,-3…), resolveTagId (tag par nom puis slug, création idempotente), computeReadTime (len/900, min 1), getSettings (9 clés + défauts), pickBanner (rotation pondérée par weight côté serveur, slot actif, dates valides), rateLimit/clientIp (mémoire), isEmail, parseDate, EPISODE_VISIBLE
- Créé src/lib/server/public-articles.ts : listing public partagé (filtres rubrique+sous-rubriques, sub, q LIKE, tag, hasVideo, sort recent|views|oldest, page/limit max 48)
- 12 routes publiques : home (settings, rubriques+children, flash, featured main/secondary≤6, rubriqueBlocks 4 derniers articles par rubrique racine incl. sous-rubriques, mostRead 5 (30 j via ArticleViewLog.groupBy sinon top views), latestEpisodes 4, latestVideos 4, ads header/footer/intercalaire/sidebar), flash, settings, emissions (+fmLabel), page/[key] (404 si absente, clés about|legal|privacy), articles, articles/[slug] (compteur views + upsert ArticleViewLog jour YYYY-MM-DD, similar 4 : même rubrique → tags communs → récents, settings inclus en bonus), search (alias), contact (validation FR, honeypot→ok sans enregistrement, 429 après 3 msg/5 min/IP), ads/[id]/click, ads/impression, episodes/listen (no-op si pas d'id)
- 32 routes admin : auth (login 423 verrouillé X min / 401 Identifiants incorrects / cookie tg_session, logout, me), overview (10 cartes, recents, top 5), stats (period day|week|month|all, timeline 30 points à zéro, byRubrique/byAuthor période, mediaMix Texte/Vidéo/Audio, top/bottom 5), logs (filtres type/userId, 50 derniers), articles CRUD (slug unique, readTime auto, tags par nom upsert, Media si coverImage, publishedAt=now au passage à PUBLISHED, journalisation CREATE/UPDATE/DELETE), duplicate (-copie, DRAFT, vue 0, tags copiés), featured GET/PUT (reset updateMany puis 1 puis 2..n), rubriques CRUD (DELETE refusé 409 si articles OU sous-rubriques, message propose isActive=false), flash CRUD, emissions CRUD (cascade épisodes), episodes CRUD (+filtre emissionId), contacts CRUD, socials CRUD, messages (status unread|read|archived|all + q) / PUT (isRead/isArchived) / DELETE, ads slots GET / PUT, campaigns CRUD (+slot+annonceur), advertisers GET/POST, settings GET/PUT (upsert par clé, maintenance normalisée on/off), settings/pages/[key] PUT (about|legal|privacy), upload (formData, extensions image jpg/jpeg/png/webp/gif ≤5 Mo, audio mp3/wav/ogg/m4a ≤30 Mo, video mp4/webm ≤100 Mo, → public/uploads/images|audios|videos/, nom Date.now()-slug.ext, retour {url})
- Testé chaque endpoint au curl : création/duplication/publication/suppression d'article, tags existants (Conakry) et nouveaux, refus suppression rubrique avec articles (409), rotation pub + click/impression, upload (bon + extensions interdites + type erroné + non authentifié), rate limit contact (3 OK puis 429), honeypot (ok sans enregistrement), 404 slug/page inconnus, verrouillage/défaut de login, logout (Set-Cookie Max-Age=0)
- Corrigé en cours de route : (1) connectOrCreate de tags bySlug qui recréait un name existant → resolveTagId par nom d'abord ; (2) toFull media type union ; (3) orderBy Prisma typé ; (4) typo syntaxique slots/[id]
- Nettoyé toutes les données de test (article, rubrique, flash, émission, épisode, contact, social, campagne, annonceur, messages rate-limit, tags Test/Test2) + image upload de test supprimée
- Lint : 0 erreur dans mes fichiers (4 warnings restants = fichiers d'autres agents) ; tsc --noEmit : 0 erreur dans src/app/api + src/lib/server

Stage Summary:
- 46 fichiers créés : 44 route handlers (12 publics + 32 admin) sous src/app/api/ + 2 modules serveur (src/lib/server/helpers.ts, src/lib/server/public-articles.ts). Aucune page, aucun composant React.
- Contrat RESPECTÉ : réponses aux formes exactes de src/lib/api.ts / types.ts. Écarts assumés : (1) GET articles/[slug] inclut aussi `settings` (utilisé par article-view.tsx, sans coût) ; (2) ads click/impression/episodes listen répondent {ok:true} même si l'id est inconnu (suivi non bloquant) ; (3) suppression rubrique refusée aussi si sous-rubriques rattachées (sécurité) ; (4) `/api/public/search` créé (alias prévu au worklog, absent du brief).
- requireUser() obligatoire + 401 {error:'Non authentifié'} sur TOUT /api/admin/* ; logAction sur toutes les mutations (CREATE/UPDATE/DELETE/LOGIN) ; mots de passe jamais renvoyés (selects explicites).
- Connexion démo testée : admin@topguinee.info / •••••••• (cookie tg_session httpOnly 12 h).
- AGENTS FRONT (2-b/2-c) : consommez publicApi/adminApi de src/lib/api.ts tels quels ; pickBanner est déjà côté serveur (ads dans HomeData) — n'appelez pas pickBanner client pour la home ; POST /api/public/ads/impression {campaignId} à l'affichage ; POST /api/public/episodes/listen {episodeId?} optionnel au play.
---
Task ID: 2-b
Agent: Front-office agent
Task: Site public complet (§4) — layout global, 10 vues, pubs avec impressions, charte tg-*

Work Log:
- Lu worklog.md, src/lib/api.ts, src/lib/types.ts, src/lib/router.tsx, src/components/tg/shared.tsx, globals.css + vérifié le contrat réel via curl sur /api/public/* (home, articles, article, emissions, page, settings)
- Créé src/components/front/common.tsx : hook useAsyncData (idempotent StrictMode — promesse en cours réutilisée via inflightRef, loading DÉRIVÉ de la clé donc zéro setState synchrone dans l'effet, compatible React Compiler), cache module getHomeCached (1 seule requête /api/public/home partagée entre header/footer/ads/vues), ImpressionBanner (wrappe AdBanner, POST /api/public/ads/impression {campaignId} une seule fois par instance), RubriqueIcon (icônes lucide stockées en base), useRubriques/flattenRubriques, shareUrl, squelettes (Card/Cards/Lines/List), ErrorState avec bouton Réessayer, EmptyState
- Créé src/components/front/front-office.tsx : FrontOffice (signature exacte demandée) avec aiguillage /, /rubrique/[slug]?sub&page&sort, /article/[slug], /recherche?q, /fm, /about, /contact, /legal, /privacy, 404 + MaintenanceView plein écran si settings.maintenance==='on' ; FlashTicker, header sticky 2 rangées bg-tg-navy (logo 40px, nom+slogan, recherche Enter→/recherche?q=, bouton FM Radio+pastille rouge pulsante, socials xl, admin discret), nav rubriques desktop avec DropdownMenu pour les children + état actif, menu mobile Sheet (recherche, FM, rubriques+sous-rubriques, socials, admin ; liens = SheetClose asChild), HeaderAd sous le header (null si pas de bannière), footer mt-auto 4 colonnes (À propos, Rubriques, Contact mailto/tel:/wa.me sans + ni espaces, socials + liens légaux/admin) + pub footer + ligne © année + « L'information au sommet de l'actualité », bouton retour en haut après 400px, skip-link clavier (sans toucher au hash), titre document via seoTitle
- Créé home-view.tsx : À la Une (hero lg:2/3 + colonne secondaires medium puis horizontaux, repli en grille si pas de principal, EmptyState « La Une se prépare »), intercalaire pub (null si absent), blocs par rubrique (SectionHeader couleur + Tout voir, 1 large + 3 medium, 4e masquée md/lg), intercalaire un bloc sur deux, Les plus lus top 5 numéroté (chiffres colorés contrastés) + sidebar (pub sidebar + derniers épisodes compacts), section Médias 2 colonnes (Vidéos : YouTubeEmbed du 1er + horizontaux ; Podcasts/FM : épisodes AudioPlayer compact + lien /fm)
- Créé rubrique-view.tsx : breadcrumb, en-tête icône/couleur + total articles, chips sous-rubriques (couleur de la sous-rubrique active) + Select tri (Plus récents/Plus anciens/Plus lus → query sort), article vedette large pleine largeur puis grille medium, Pagination préservant sub/sort, sidebar desktop (pub + Les plus lus tri views), EmptyState par sous-rubrique
- Créé article-view.tsx : barre .tg-read-progress (useEffect scroll+resize, role=progressbar), breadcrumb titre tronqué 46 car., badge rubrique cliquable, H1 font-display, subtitle, meta (auteur, fmt.dateTime, readTime, vues), couverture FadeImage 16/9, YouTubeEmbed, ShareButtons (URL absolue #/article/slug), corps RichText, pub in-article entre corps et tags (intercalaire du home), tags cliquables → /recherche?q=, sidebar sticky (pub, À lire aussi = similar en small, Les plus lus), Articles similaires en bas grille medium, skeleton dédié, erreur réseau → ErrorState, 404 → NotFoundView, document.title dynamique
- Créé search-view.tsx : formulaire avec terme pré-rempli, résultats cartes horizontales + Pagination, compteur « N résultats pour … », sans q → invitation + rubriques populaires, aucun résultat → suggestions + rubriques
- Créé fm-view.tsx : hero navy « {fmLabel} — Podcasts & chroniques », carte par émission (couverture, badge type, description) avec épisodes (AudioPlayer complet, fmt.duration, date, écoutes), EmptyState élégant
- Créé page-views.tsx : StaticPageView paramétré (about/legal/privacy → publicApi.page, SectionHeader + RichText, contenu vide géré) et ContactView (cartes coordonnées mailto/tel:/wa.me, grille socials colorés par plateforme, formulaire shadcn nom/email/sujet/message + honeypot name="website" tabIndex=-1 caché, validation regex email, submit → publicApi.contact, toasts sonner succès/erreur, Loader2 pendant l'envoi)
- Créé not-found-view.tsx : 404 dégradé tricolore, message humoristique, boutons Accueil/Recherche, chips de rubriques
- Corrigé : style non supporté par Link (routeur) → wrappers span pour couleurs dynamiques ; RubriqueIcon accepte style ; MobileNavLink via SheetClose ; hook réécrit sans setState synchrone dans l'effet (erreur react-hooks/set-state-in-effect)
- Vérifié le contrat réel de l'API (agent 2-a livré) : featured vide géré, ads.header/intercalaire/sidebar présents & footer null → null (aucun espace vide), rubriques avec children[], emissions avec épisodes, page about, settings/contacts/socials
- Lint final : 0 erreur dans src/components/front/* (5 warnings restants = fichiers admin d'un autre agent)

Stage Summary:
- Fichiers créés (uniquement dans src/components/front/) : common.tsx, front-office.tsx, home-view.tsx, rubrique-view.tsx, article-view.tsx, search-view.tsx, fm-view.tsx, page-views.tsx, not-found-view.tsx
- AUCUNE modification de page.tsx, src/lib/*, src/components/tg/*, routes API (respecté)
- Composant principal : export nommé FrontOffice depuis src/components/front/front-office.tsx — props { route: { segments: string[]; query: URLSearchParams }, settings: SiteSettings, contacts: ContactChannel[], socials: SocialLink[], flash: FlashInfo[], onOpenAdmin: () => void }
- Vues auto-alimentées via publicApi ; données globales (settings/contacts/socials/flash) reçues en props ; rubriques+ads chargés via cache partagé getHomeCached (1 seule requête home)
- Impression pub : POST /api/public/ads/impression {campaignId} via ImpressionBanner (une fois par instance rendue)
- Pour l'orchestrateur/shell : rendre <FrontOffice route={useHashRoute()} settings={...} contacts={...} socials={...} flash={...} onOpenAdmin={() => navigate('/admin')} /> depuis page.tsx (flex col min-h-screen déjà géré en interne)
---
Task ID: 2-c
Agent: Back-office agent (rapport final perdu — réseau ; entrée rédigée par l'orchestrateur après vérification)
Task: Cockpit éditorial complet (§7) — login, layout admin, 12 sections

Work Log:
- Lu worklog.md + src/lib/api.ts (adminApi) + types + shared
- Créé 16 fichiers dans src/components/admin/ : admin-app.tsx (341 l., layout + aiguillage + auth me/login/logout + badges), admin-shared.tsx, login-view.tsx (charte navy, démo creds, erreurs FR), overview.tsx (8 cartes + récents + activité), articles-list.tsx (filtres/onglets statut/pagination/actions), article-editor.tsx (728 l. : WYSIWYG contentEditable + toolbar complète, upload image/YouTube/audio au curseur, autosave 2,5 s, aperçu Dialog, statuts+programmation), featured-manager.tsx (principal + secondaires réordonnables), flash-manager.tsx (priorités, expiration, Switch), rubriques-manager.tsx (arbre, couleurs, icônes, réordonnancement), fm-manager.tsx (émissions + épisodes, upload audio), contacts-manager.tsx (canaux + réseaux), messages-inbox.tsx (filtres, lecture, répondre mailto, archivage), ads-manager.tsx (3 onglets : slots plan du site / campagnes / annonceurs), stats-view.tsx (recharts : timeline/rubriques/auteurs/mediaMix + export CSV + print), settings-view.tsx (général/SEO/pages éditables/maintenance), logs-view.tsx
- Navigation admin : /admin, /admin/articles(+new,edit?id), /admin/a-la-une, /admin/flash, /admin/rubriques, /admin/fm, /admin/contacts, /admin/messages, /admin/publicite, /admin/statistiques, /admin/parametres, /admin/journal
- Lint : 0 erreur sur ses fichiers

Stage Summary:
- Export nommé : AdminApp({ route: { segments: string[]; query: URLSearchParams }, onExitToSite: () => void }) depuis src/components/admin/admin-app.tsx
- L'auth est gérée en interne (adminApi.me → LoginView si 401). Toaster sonner monté dans AdminApp.
- Sidebar desktop fixe 264px + Sheet mobile + topbar sticky avec recherche globale et liseré tricolore.
---
Task ID: 3
Agent: Z.ai Code (orchestrateur)
Task: Intégration finale — shell SPA (page.tsx + layout.tsx), assets de marque, recette Agent Browser bout-en-bout, corrections

Work Log:
- Créé src/app/page.tsx (shell) : chargement global settings/flash (recharge ticker toutes les 90 s §4.8), aiguillage route hash → AdminApp (#/admin/*) ou FrontOffice, écran de chargement à la charte (logo + slogan + drapeau), écran d'erreur réseau avec Réessayer
- Mis à jour layout.tsx : métadonnées SEO complètes Topguinee.info (titre, description, Open Graph fr_FR, Twitter Cards, favicon logo), lang="fr"
- Assets générés via z-ai (12 images) : logo (3 sommets R/J/V sur disque marine — 2e version après logo « lettre A » rejeté), 7 couvertures articles, 2 couvertures émissions, 2 bannières pub (1re tentative écartée : texte chinois + format 1440x720 invalide → 1344x768)
- Audio épisodes : TTS « Journal Parlé » (sample-chronique.wav, mp3 non supporté par l'API) + mise à jour audioUrl des 4 épisodes en base
- Recette Agent Browser (§12 du CDC) :
  * Accueil : ticker, nav+sous-rubriques, pubs, À la Une (hero+5), 6 blocs rubrique, Les plus lus, Vidéos/Podcasts avec lecteurs, footer complet ✓
  * Article : breadcrumb, H1/sous-titre/meta, corps riche (h2/citations/listes), partage social, tags, À lire aussi, sidebar, compteur vues incrémenté ✓
  * Admin : login (••••••••) → vue d'ensemble (8 cartes + activité) ✓ ; éditeur complet (titre/description compteur/WYSIWYG/rubrique) → publication réussie → article immédiatement visible via API publique (sync §7.12 validée) ✓ ; stats (recharts, exports) ✓ ; pub (3 onglets, campagnes actives) ✓ ; FM/épisodes ✓ ; messagerie (formulaire contact → réception boîte interne validé §4.4→§7.8) ✓
  * 404 personnalisée ✓, FM public ✓, Contact ✓, À propos ✓, recherche ✓, mobile 390px (burger, hero responsive) ✓
- Corrections de recette : featuredOrder restaurés (vidés par les tests API de 2-a), FadeImage corrigé (images en cache : onLoad avant attache handler → ref callback), imports useCallback manquant, lint setState-in-effect (page.tsx + shared.tsx)
- Nettoyage données de test (article « Test recette », messages de test)
- Lint final : 0 erreur, 0 warning. Serveur : 200 OK, aucune erreur runtime.

Stage Summary:
- PROJET CONFORME AU CAHIER DES CHARGES v2.0. Livré : front-office complet (§4), cockpit éditorial 12 modules (§7), pub (§8), schéma données 18 entités (§9.2 — SQLite portable PostgreSQL), charte graphique respectée (§3.2), SEO (§9.7), sécurité (auth sessions signées, verrouillage, honeypot, rate limit — §7.2/§9.6)
- Comptes : admin@topguinee.info / •••••••• · journaliste@topguinee.info / ••••••••
- Abstractions production : uploads locaux → Cloudinary (images) & Google Drive (audio) à brancher côté /api/admin/upload + /api/public (contrat inchangé)

---
Task ID: 4-a
Agent: Z.ai Code (orchestrateur)
Task: Refonte UI « premium éditorial » — design system, fonts, composants partagés, masthead, accueil

Work Log:
- Exigence client : interface « beaucoup plus professionnelle, ultra haut de gamme, raffinée » — abandon du style SaaS (cartes rounded-2xl, boîtes partout) au profit d'un design éditorial de presse (Le Monde / NYT)
- globals.css réécrit : tokens affinés, utilities premium (.tg-container, .tg-kicker, .tg-title-link soulignement animé, .tg-flag-v, .tg-tricolor-band, .tg-zoom), tg-prose en serif Georgia 16.5px avec lettrine .tg-dropcap, radius global réduit (0.375rem), ::selection navy
- layout.tsx : fonts Google Playfair Display (--font-playfair) + Inter (--font-inter) via next/font, Geist retiré
- shared.tsx entièrement refait : ArticleCard 5 variantes (hero overlay serif 40px, large/medium sans boîte + kicker + serif, small, horizontal), RubriqueKicker, MetaLine, SectionHeader (filet 2px navy + losange 45°), FlashTicker affiné, AdBanner net, ShareButtons cercles animés, AudioPlayer (bouton navy→rouge), Breadcrumb kicker chevrons, Pagination carrée — signatures inchangées
- common.tsx : squelettes/states alignés (rounded-sm, tg-paper, font-display)
- front-office.tsx refait : barre utilitaire (date FR, contacts, socials), masthead de presse centré (logo + wordmark serif bicolore + slogan filets tricolores), nav sticky navy uppercase avec soulignement jaune actif + dropdowns raffinés, rangée mobile sticky compacte, SearchOverlay plein écran (input serif géant), footer premium 12 colonnes (marque, rubriques, contact, le média) + bande tricolore, maintenance/scroll-top affinés
- home-view.tsx refait : À la Une magazine (hero 8 cols + rail 4 cols filets), blocs rubrique « grand article + liste horizontale filets », Les plus lus numérotés serif colorés, sidebar épisodes, Médias 2 colonnes

Stage Summary:
- DESIGN SYSTEM PREMIUM EN PLACE. AGENTS : lisez globals.css + shared.tsx + front-office.tsx + home-view.tsx pour vous imprégner du style, réutilisez les classes (.tg-kicker, .tg-container, .tg-title-link, .tg-zoom, .tg-dropcap) et composants existants. Signatures des composants inchangées → aucune rupture d'API.
- Reste à faire (4-b/4-c/4-d) : article-view, rubrique-view, search-view, fm-view, page-views, not-found-view — même langage visuel.

---
Task ID: 4-d
Agent: Frontend premium — FM + pages + 404
Task: Refonte « premium éditorial » de fm-view.tsx, page-views.tsx, not-found-view.tsx (logique/contrats API préservés, design seul changé)

Work Log:
- Lu worklog.md (4-a), globals.css (utilities .tg-kicker/.tg-container/.tg-title-link/.tg-zoom/.tg-prose+.tg-dropcap/.tg-flag-stripe/.tg-tricolor-band), shared.tsx, front-office.tsx (SearchOverlay, footer), home-view.tsx, common.tsx, types.ts + api.ts — langage visuel aligné avant de coder
- fm-view.tsx : hero pleine largeur bg-tg-navy-dark avec .tg-tricolor-band en haut (absolu), kicker tricolore jaune « Podcasts & chroniques » + .tg-flag-stripe, H1 font-display font-black text-[30px] md:text-[42px] (fmLabel), sous-titre zinc-400, médaillon circulaire « En antenne » (point jaune pulsant + Radio) masqué sous md ; cartes émission rounded-sm border-zinc-200 bg-white : cover w-32 md:w-44 aspect-[3/2] avec .tg-zoom (group), kicker type coloré + losange rotate-45 (FM rouge/PODCAST vert/CHRONIQUE navy), titre serif text-xl, description line-clamp-2, compteur d'épisodes en kicker ; épisodes en ul divide-y py-5 : kicker émission coloré, titre serif, méta tabular-nums (Clock durée fmt.duration, Headphones écoutes fmt.num, date fmt.short), AudioPlayer compact (le lecteur complet répéterait le titre déjà affiché en éditorial — contrôles vitesse/volume intégrés dès md) ; FMSkeleton premium (2 cartes cover+lecteur), EmptyState/ErrorState conservés
- page-views.tsx : PageHero commun (kicker losange rouge + H1 font-display font-bold text-[28px] md:text-[36px] tracking-tight navy + filet w-16 border-b-2 border-tg-navy) ; StaticPageView : Breadcrumb, contenu max-w-[760px], RichText className="tg-dropcap" (lettrine Playfair) sous filet border-t, PAGE_KICKERS (Le média / Informations légales / Vos données), garde publicApi.page + fallbackTitle + EmptyState « Contenu en préparation » ; ContactView : en-tête identique + intro, grille lg:grid-cols-5 gap-10 — gauche col-span-2 : rangées ContactRow (cercle w-11 h-11 rounded-full border-zinc-200 → group-hover:bg-tg-navy/text-white, label kicker, valeur semibold navy, href mailto/tel:/wa.me inchangé, hover border-tg-navy) + réseaux en cercles bord hover jaune/-translate-y (comme footer) ; droite col-span-3 : formulaire rounded-sm avec en-tête « Formulaire / Écrivez-nous », labels tg-kicker text-zinc-500 (Field helper), inputs/textarea rounded-sm border-zinc-300 focus-visible:border-tg-navy focus-visible:ring-0 h-11 / min-h-[140px], submit w-full h-12 bg-tg-navy hover:bg-tg-red rounded-sm + Loader2 ; honeypot name="website" tabIndex=-1, validation email, publicApi.contact, toasts sonner, états sending/erreurs : TOUS conservés à l'identique ; ContactSkeleton en grille
- not-found-view.tsx : bloc max-w-3xl rounded-sm border-zinc-200 bg-tg-paper, « 404 » font-display font-black text-[110px] md:text-[160px] leading-[0.85] text-tg-navy/10 en filigrane, kicker rouge « Erreur de navigation » en léger chevauchement, H1 serif « Page introuvable », message raffiné, deux boutons min-h-[44px] : Retour à l'accueil (navy plein → hover rouge) + Rechercher (outline navy → hover plein), chips rubriques via useRubriques (icône colorée, min-h-[44px], hover border-tg-navy), .tg-tricolor-band en bas du bloc ; export NotFoundView inchangé
- Validation : bunx eslint sur les 3 fichiers → 0 erreur 0 warning ; tsc --noEmit → 0 erreur sur ces fichiers. Note : 1 erreur lint préexistante dans front-office.tsx:152 (setToday dans useEffect, fichier de la tâche 4-a, hors périmètre — non modifié conformément aux consignes)

Stage Summary:
- 3 fichiers refaits, aucune modification ailleurs (shared/common/lib/front-office intacts), aucune nouvelle dépendance, 'use client' en tête
- Contrats préservés : FMView({fmLabel}) + publicApi.emissions(), StaticPageView({pageKey,fallbackTitle}) + publicApi.page, ContactView() + publicApi.settings/contact + honeypot + sonner, NotFoundView + useRubriques — imports depuis './common' et '@/components/tg/shared' inchangés
- Langage premium éditorial homogène : serif Playfair pour titres, kickers uppercase tracking 0.16em, coins rounded-sm, filets zinc-200, palette navy/rouge/jaune/vert, losanges rotate-45, bandes tricolores, transitions 300–600 ms, cibles ≥44 px, responsive mobile-first

---
Task ID: 4-b
Agent: Frontend premium — article-view
Task: Refonte « premium éditorial » de la lecture d'article — src/components/front/article-view.tsx (un seul fichier modifié)

Work Log:
- Lu worklog.md (entrées 1 → 4-a), globals.css (utilities .tg-kicker/.tg-container/.tg-title-link/.tg-zoom/.tg-dropcap/.tg-tricolor-band), shared.tsx, common.tsx, home-view.tsx, front-office.tsx, types.ts, api.ts, router.tsx pour m'imprégner du langage visuel et des contrats
- Garde 100 % de la logique : export ArticleView({ slug }), useAsyncData(publicApi.article(slug)) + getHomeCached + publicApi.articles({sort:'views',limit:5}) pour Les plus lus, effets progression de lecture (.tg-read-progress tricolore 2px, role=progressbar) et document.title dynamique, 404 → NotFoundView, erreur réseau → ErrorState + Réessayer, shareUrl() + ShareButtons, compteur de vues côté API
- En-tête de presse (conteneur max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8) : Breadcrumb existant, badge rubrique cliquable en kicker couleur rubrique avec losange rotate-45 (hover opacité 300ms — style porté par un span interne car le Link du routeur n'accepte pas style), H1 font-display bold text-[30px]/md:text-[40px] leading-[1.12] tracking-tight text-tg-navy text-balance, chapo subtitle en font-display italic zinc-500, mesure de lecture limitée à max-w-[860px]
- Ligne méta raffinée : pastille ronde navy avec initiale de l'auteur (font-display), nom en semibold, séparateurs points médians — date complète fmt.dateTime, « X min de lecture » (Clock), vues (Eye, fmt.num) — filet border-b border-zinc-200, ShareButtons alignés à droite (ml-auto, passe à la ligne à droite sur mobile)
- Couverture : rounded-sm, aspect 16/9, filet zinc-200, FadeImage priority + .tg-zoom (zoom lent 0.9s au survol du groupe), figcaption italique avec coverAlt ; YouTubeEmbed conservé si youtubeUrl
- Corps : grille lg:grid-cols-[minmax(0,1fr)_320px] gap-10, colonne de lecture max-w-[720px], RichText avec className tg-dropcap (lettrine Playfair automatique), encart pub via ImpressionBanner(home.ads.intercalaire, position="intercalaire") entre corps et sujets liés, section « Sujets liés » (kicker + losange) avec chips rounded-sm border-zinc-300 px-3 py-1.5 uppercase hover:border-tg-red hover:text-tg-red → /recherche?q=
- Sidebar sticky lg:top-24 sans boîtes : pub sidebar (ImpressionBanner), panneau « À lire aussi » (similar en ArticleCard horizontal, filets divide-y), panneau « Les plus lus » (top 5 numérotés en serif coloré — palette rouge/or/vert/marine/grenat — ArticleCard small)
- Bas de page « À lire aussi » : section pleine largeur bg-tg-paper surmontée du bandeau .tg-tricolor-band, SectionHeader + lien « Toute la rubrique » (kicker rouge + ArrowRight animé au survol), grille sm:grid-cols-2 lg:grid-cols-4 d'ArticleCard medium
- Squelette dédié premium refait à l'identique du nouveau layout (divs zinc-100 animate-pulse rounded-sm : breadcrumb, titre, méta pastille, couverture 16/9, lignes de corps, sidebar) ; apparitions tg-fade-up + délais tg-fade-1/2
- Corrections passage : aria-label → ariaLabel (signature du Link du routeur), déplacement du style couleur dans un span interne ; similar hardé (data.similar || [])
- Validation : eslint sur le fichier → 0 erreur 0 warning ; tsc --noEmit → 0 erreur dans article-view.tsx ; aucune couleur indigo/blue, aucun rounded-xl/2xl (les seuls rounded-full sont la pastille auteur et son squelette, voulus)

Stage Summary:
- article-view.tsx est désormais aligné sur le design system « premium éditorial » de la tâche 4-a : masthead d'article de presse (kicker, serif, chapo, méta pastille), colonne de lecture 720px avec lettrine, filets fins zinc-200 au lieu de boîtes grisâtres, sidebar sticky éditoriale, bas de page bg-tg-paper avec bande tricolore
- AUCUN autre fichier modifié (shared.tsx, common.tsx, lib/*, app/* intacts) ; contrats API et props inchangés ; aucune dépendance ajoutée
- Note pour l'orchestrateur : `bun run lint` global remonte 1 erreur préexistante dans front-office.tsx:152 (react-hooks/set-state-in-effect, setToday dans l'effet de la date du jour — fichier de la tâche 4-a, hors de mon périmètre) ; article-view.tsx est à 0 erreur

---
Task ID: 4-c
Agent: Frontend premium — rubrique + recherche
Task: Refonte « premium éditorial » des vues rubrique-view.tsx et search-view.tsx (design system Task 4-a), logique/contrats API inchangés

Work Log:
- Lu worklog.md (entrées 1→4-a), globals.css (.tg-container/.tg-kicker/.tg-title-link/.tg-zoom/.tg-flag-stripe), shared.tsx (ArticleCard 5 variantes, SectionHeader losange, Breadcrumb, Pagination carrée), common.tsx (useAsyncData, getHomeCached, ImpressionBanner, squelettes), home-view.tsx + front-office.tsx (langage visuel de référence), types.ts/api.ts (contrats)
- rubrique-view.tsx refait : en-tête de presse (losange rotate-45 rempli de la couleur rubrique avec icône contrastée via calcul de luminance, H1 font-display 28/36 tracking-tight navy, ligne kicker « N articles » + parent éventuel + sous-rubrique active, filet signature = trait fin pleine largeur + accent 2px × 80px couleur rubrique) ; chips sous-rubriques scrollables (rounded-full, h-11, border-zinc-300 → hover navy ; active = fond couleur sous-rubrique ou repli navy si couleur trop claire pour AA) + Select tri premium (h-10 rounded-sm border-zinc-300) ; article vedette ArticleCard large pleine largeur puis grille sm:2/lg:4 gap-x-6 gap-y-10 medium (limit: 9 inchangé) ; Pagination conservée (makeHref sub/sort/page identique) ; EmptyState par sous-rubrique, ErrorState, squelette premium (vedette + 8 CardSkeleton) ; « Les plus lus » en section pleine largeur sous la grille (col-span-2 numéros serif RANK_COLORS comme la home + filets) avec aside pub sidebar (ImpressionBanner via getHomeCached, hidden lg:block lg:col-start-3)
- search-view.tsx refait : en-tête losange rouge + H1 « Recherche » font-display 28/36 ; formulaire à filet (wrapper border-b-2 border-zinc-300 focus-within:border-tg-navy, input font-display text-xl h-14 bg-transparent, bouton carré navy w-14 h-14 collé à droite, icône Search blanche, hover:bg-tg-red, focus-visible outline) ; compteur kicker « N résultat(s) pour “q” » (role=status aria-live) ; résultats en liste divide-y divide-zinc-200 (ArticleCard horizontal, py-5) ; sans q → invitation centrée (kicker + flag-stripes + serif) + chips rubriques populaires (→ /rubrique/slug) ; aucun résultat → composition SearchX + conseils (diamants séparateurs) + chips rubriques ; Pagination inchangée (makeHref identique)
- Correction technique : Link du routeur n'accepte pas `style` → fond dynamique des chips actives porté par un span wrapper rounded-full (même pattern que 2-b) ; cibles tactiles ≥44px partout (h-11 chips, h-14 input/bouton)
- Validation : eslint sur mes 2 fichiers = 0 erreur 0 warning ; tsc --noEmit = 0 erreur sur mes 2 fichiers ; recette navigateur impossible car le shell partagé front-office.tsx est en cours d'édition par un autre agent (erreurs concurrentes : `const obileOpen` ligne 139, `seg0` hors portée lignes 325/369 dans SiteHeader) — plantage sur TOUTES les routes y compris /, sans rapport avec mes fichiers (preuve : mon premier `bun run lint` complet après écriture des 2 vues était 100 % clean)

Stage Summary:
- 2 fichiers livrés : src/components/front/rubrique-view.tsx (249 lignes) et src/components/front/search-view.tsx (186 lignes). AUCUNE autre modification (shared/common/lib/page.tsx intacts, aucune dépendance ajoutée)
- Exports et props inchangés : RubriqueView({slug,sub,page,sort}), SearchView({q,page}) ; mêmes appels publicApi (articles limit 9 rubrique / limit 8 recherche, getHomeCached, most-read) ; tri/pagination/sous-rubriques conservés à l'identique
- Langage « premium éditorial » respecté : serif Playfair pour titres, kickers uppercase 0.16em, coins nets rounded-sm, filets zinc-200, losanges rotate-45, navy/rouge/jaune/vert exclusivement, transitions 300–700 ms, pas de boîtes autour des articles
- Attention orchestrateur : le lint projet complet échoue actuellement UNIQUEMENT à cause de front-office.tsx (agent concurrent en cours d'écriture) — à re-vérifier une fois l'agent 4-b/4-d terminé ; mes 2 fichiers restent sains (eslint + tsc isolés OK)

---
Task ID: 4-e
Agent: Z.ai Code (orchestrateur)
Task: Intégration finale de la refonte premium — corrections, recette Agent Browser, validation

Work Log:
- Corrigé front-office.tsx : (1) `seg0` utilisé dans SiteHeader sans être défini → ajout prop `activeSeg0` ; (2) lint set-state-in-effect sur la date → initialisation paresseuse useState()
- Corrigé layout.tsx : variables next/font déplacées de <body> vers <html> — les @theme --font-display/--font-sans référencent var(--font-playfair/--font-inter) résolues au niveau :root ; sur <body>, la résolution échouait (font serif jamais appliquée)
- Corrigé shared.tsx MetaLine : métadonnées compactées (whitespace-nowrap, lecture time masquée hors hero) — plus de retour à la ligne dans les colonnes étroites
- Diagnostiqué + résolu : CSS périmé servi par le dev server (redémarrage nécessaire après réécriture de globals.css)
- Recette Agent Browser complète (desktop 1440 + mobile 390) : accueil (masthead, ticker, hero serif, rail, blocs rubrique, pubs, footer), article premium (breadcrumb, H1 Playfair, méta avec avatar, lettrine, sidebar sticky, À lire aussi), rubrique (en-tête losange + chips + tri), FM (hero navy tricolore + lecteurs), recherche (formulaire + résultats) + overlay plein écran (navigation réelle vérifiée), contact (formulaire soumis → message en base, nettoyé ensuite), 404, menu mobile Sheet
- Lint final : 0 erreur, 0 warning. Aucune erreur runtime dans dev.log

Stage Summary:
- REFORTE PREMIUM LIVRÉE ET VÉRIFIÉE. Design system éditorial complet : Playfair Display (titres) + Inter (UI), filets, losanges, tricolore, hover raffinés. Toutes les vues publiques refaites ; back-office inchangé (fonctionnel, style cohérent shadcn). Comptes et API inchangés.

---
Task ID: 5-a
Agent: Claude Sonnet 4.6 (sub-agent 5-a)
Task: Onglets admin « FM & TV » (activation FM/TV, direct YouTube/Facebook) + « Stockage » (Cloudinary / Google Drive avec test de connexion) ; correction des appels uploadFile du logo.

Work Log:
- Lu worklog.md + vérifié le backend existant : SiteSettings (fmEnabled/tvEnabled/tvLabel/tvYoutubeUrl/tvFacebookUrl), StorageTestResult, adminApi.testStorage, uploadFile → UploadResult { url, provider, warning }, getStorageConfig() dans src/lib/server/helpers.ts
- settings-view.tsx : corrigé les 2 handlers d'upload du logo (onglet Général) pour consommer UploadResult : setDraft(logoUrl: res.url) + toast.warning('Logo importé avec réserve') si res.warning + toast.success('Logo transféré sur Cloudinary') si res.provider === 'cloudinary'
- settings-view.tsx : supprimé le champ « Libellé public de la section FM / Podcasts » de l'onglet Général, retiré fmLabel de saveGeneral (toast « Général enregistré » mis à jour)
- settings-view.tsx : ajouté onglet « FM & TV » (icône Radio, juste après Général) : switch fmEnabled + aide « disparaît du menu, du pied de page… /fm indisponible », champ fmLabel (déplacé), hr border-zinc-200, switch tvEnabled + aide, tvLabel, tvYoutubeUrl (note « Laisser vide si vous n'utilisez que Facebook »), tvFacebookUrl (note « vidéo publique »), bouton bg-tg-red → saveFmTv() = updateSettings({ fmEnabled, tvEnabled, tvLabel, tvYoutubeUrl, tvFacebookUrl, fmLabel }) + setSettings + toast « FM & TV enregistrés »
- settings-view.tsx : ajouté onglet « Stockage » (icône CloudUpload, même carte unique avec 2 blocs séparés par hr) : bloc Cloudinary — storageCloudName « Cloud name », storageCloudApiKey « API key », storageCloudApiSecret « API secret » type=password + note cloudinary.com ; bloc Google Drive — storageDriveFolderId « Identifiant du dossier Drive », storageDriveClientEmail « E-mail du compte de service », storageDrivePrivateKey Textarea rows=4 font-mono text-xs « Clé privée du compte de service » + note streaming/Google Cloud ; boutons « Enregistrer la configuration » (bg-tg-red) et « Tester les connexions » (variant outline, Loader2) → adminApi.testStorage() rendu en pastilles StorageTestBadge (CheckCircle2 vert / XCircle rouge + message), état useState<StorageTestResult | null>
- Gestion des secrets côté client : état local storageDraft (6 clés storage*, hors SiteSettings) prérempli depuis res.storage du GET ; snapshot storageInitial gardé en parallèle ; saveStorage() n'envoie QUE les champs dont la valeur diffère du snapshot → une valeur masquée « •••••••• » non modifiée n'est jamais renvoyée et ne peut pas écraser le secret existant ; note UI « Affichée masquée (••••••••) une fois configurée »
- route.ts GET : renvoie désormais { settings, pages, storage: { storageCloudName, storageCloudApiKey, storageCloudApiSecret: masqué si non vide, storageDriveFolderId, storageDriveClientEmail, storageDrivePrivateKey: masqué si non vide } } via getStorageConfig() (fallback env conservé, secrets jamais exposés en clair)
- route.ts PUT : boucle étendue aux clés de stockage (const locale STORAGE_SETTING_KEYS — le PUT d'origine n'itérait que SETTING_KEYS et ignorait donc silencieusement les clés storage*, contrairement à l'énoncé) + garde-fou serveur : une valeur reçue égale à la sentinelle « •••••••• » n'est JAMAIS stockée
- Validation : bunx eslint sur mes 2 fichiers = 0 erreur 0 warning ; bunx tsc --noEmit = 0 erreur dans mes 2 fichiers
- Recette API réelle sur le dev server (login admin) : GET renvoie le bloc storage ; PUT { storageCloudName: 'test-cloud-xyz', storageCloudApiSecret: '••••••••' } → cloudName stocké et renvoyé par le GET, sentinelle rejetée (apiSecret reste '') ; nettoyé ensuite (cloudName: '')

Stage Summary:
- 2 fichiers livrés : src/components/admin/settings-view.tsx (596 lignes) et src/app/api/admin/settings/route.ts. AUCUN autre fichier modifié.
- L'admin peut : activer/désactiver FM et TV (switches, normalisées on/off côté serveur), libeller les rubriques FM et TV, configurer le direct TV YouTube ET/OU Facebook, renseigner Cloudinary (3 champs) et Google Drive (3 champs) avec préremplissage masqué, enregistrer, et tester les deux connexions avec pastille de résultat par service.
- uploadFile du logo consomme le nouveau UploadResult (url + provider + warning) avec toasts adaptés.
- Décisions : (1) PUT étendu aux clés storage* dans route.ts car le backend existant les ignorait — sinon le bouton Enregistrer n'aurait aucun effet ; (2) diff client « valeurs modifiées uniquement » (comparaison au snapshot initial) plutôt qu'un suivi touched, même sémantique plus simple ; (3) rejet serveur de la sentinelle masquée en défense en profondeur ; (4) htmlFor/id cohérents partout (set-fmlabel, set-tvlabel, set-tvyoutube, set-tvfacebook, st-cloudname, st-apikey, st-apisecret, st-drivefolder, st-driveemail, st-drivekey).
- Attention orchestrateur — erreurs tsc HORS de mes fichiers (agents parallèles, non corrigées ici) : src/components/admin/fm-manager.tsx(421) attend encore une string de uploadFile (nouveau UploadResult) ; src/lib/server/storage.ts(11) importe StorageTestResult depuis './helpers' au lieu de '@/lib/types' et la route /api/admin/storage/test appelée par adminApi.testStorage n'existe pas encore (le bouton Tester affichera un toast d'erreur jusqu'à sa création) ; src/components/tg/shared.tsx (prop tabIndex sur TgLink) ; examples/websocket/* et skills/* = scaffolding sandbox hors projet. Par ailleurs, dans src/lib/server/helpers.ts, normalizePem() semble avoir été altéré par un scan de secrets : l'en-tête d'ouverture PEM de reconstruction vaut un placeholder de scan de secrets au lieu de la balise d'ouverture PEM standard (tirets + BEGIN PRIVATE KEY) → les clés collées AVEC en-têtes fonctionnent, celles sans en-têtes produiraient un PEM invalide (hors de mon périmètre, signalé pour correction).

---
Task ID: 5
Agent: Z.ai Code (orchestrateur)
Task: Corrections finales client — vraies images, FM/TV activables + page TV, upload d'images corrigé, Cloudinary/Drive/YouTube

Work Log:
- Corrigé le bug d'import d'images : la route /api/admin/upload appelée par uploadFile() N'EXISTAIT PAS (404 silencieux). Créé src/app/api/admin/upload/route.ts (auth, limites image 8 Mo / audio 80 Mo, validation MIME)
- Créé src/lib/server/storage.ts : upload signé Cloudinary (REST + SHA1), Google Drive via compte de service (JWT RS256 + token cache), streaming proxy avec support Range, repli local automatique public/uploads si service non configuré (dégradation gracieuse + warning toast)
- Routes : POST /api/admin/storage/test (test connexions Cloudinary/Drive), GET /api/public/media/audio/[fileId] (proxy streaming Drive, vérif parent folder anti-SSRF, Range 206)
- Paramètres : nouvelles clés fmEnabled/tvEnabled/tvLabel/tvYoutubeUrl/tvFacebookUrl (+ STORAGE_KEYS) ; PUT settings normalise les booléens 'on'/'off' et accepte les clés storage* ; GET renvoie les secrets masqués
- Agent 5-a (settings-view.tsx + api/admin/settings/route.ts) : onglet « FM & TV » (switches activation + libellés + liens direct YouTube/Facebook) et onglet « Stockage » (Cloudinary cloud/key/secret + Drive folder/service account/clé privée, bouton « Tester les connexions » avec pastilles vert/rouge) ; secrets jamais renvoyés si inchangés (sentinelle ••••••••)
- VRAIES IMAGES (image-search web, 13 requêtes, téléchargement + sharp mozjpeg 1600px q82) : Conakry (cover-une), mine de bauxite (economie), stade football (sport), djembés (culture), sommet chefs d'État (politique), centre de santé (sante), écoliers (education), UA (international), rédaction (redaction), studio radio (emission-journal), plateau TV (emission-debat), logos Orange/Ecobank (pubs). Anciennes images IA .png supprimées (logo.png conservé)
- seed.ts + base mis à jour : covers .png→.jpg avec cas spéciaux (societe→sante/education, politique→redaction), échantillon audio .mp3→.wav (le .mp3 n'existait pas)
- TV : nouvelle vue src/components/front/tv-view.tsx (hero navy tricolore, lecteur principal avec bascule YouTube/Facebook si les deux configurés, support URL chaîne (live_stream?channel=) et vidéo (watch/youtu.be/shorts/live/m.), grille « Vidéos de la rédaction » via articles hasVideo) ; routage #/tv dans front-office
- FM/TV conditionnels partout : nav desktop (lien TV outline + FM rouge), masthead (boutons FM plein + TV outline), barre mobile compacte, menu Sheet, footer « Le média » ; vue SectionUnavailable élégante si section désactivée et visitée en direct ; home : blocs Podcasts/« Derniers épisodes » masqués si fm off, lien « Voir le direct » sur bloc Vidéos si tv on (grille 1 colonne si FM off)
- Shell page.tsx : reload des settings à chaque transition admin ↔ site public (les changements FM/TV/maintenance sont visibles immédiatement)
- shared.tsx : youtubeId étendu aux formats /live/ et /v/ ; router Link : props aria-current/aria-disabled/tabIndex/onClick/style (corrigeait erreurs tsc préexistantes Pagination)
- Recette Agent Browser : accueil (vraies images, boutons FM+TV), page TV (lecteur YouTube joué + grille vidéos), désactivation TV via switch → liens disparus + /tv « Section momentanément indisponible » + réactivation, admin login, upload image (POST 200 + fichier servi + aperçu dropzone), upload audio (POST 200 + streaming 206 Range + lecture réelle currentTime avance), FM (vraies photos + lecteurs), article (YouTube embed joué), mobile 390 (barre compacte + Sheet avec FM et TV), footer collant OK, proxy audio 404 propre sans Drive
- Note : les lives « chaîne » YouTube (live_stream?channel=) refusent l'embed depuis le sandbox (referrer) — le lecteur TV fonctionne avec les vidéos/lives publics ; en production le lien de la rédaction fonctionnera. Démo : vidéo embeddable configurée, remplaçable dans Paramètres → FM & TV
- Nettoyage : fichiers de test supprimés, couverture/corps de l'article test restaurés, scripts utilitaires conservés dans scripts/ (img-search*.sh, fetch-images.ts)
- Lint final : 0 erreur, 0 warning. tsc : 0 erreur projet (hors scaffolding examples/ skills/). dev.log : aucune erreur runtime

Stage Summary:
- LIVRÉ : (1) vraies images web partout (plus aucune image IA sauf le logo-marque) ; (2) FM ET TV activables/désactivables depuis Paramètres → FM & TV avec disparition immédiate (nav/masthead/mobile/footer/accueil) + page TV complète (direct YouTube OU Facebook, bascule, grille vidéos) ; (3) import d'images corrigé — route d'upload créée, images → Cloudinary (repli local), audio → Google Drive en streaming (repli local), bouton test de connexion ; (4) YouTube vérifié fonctionnel : liens vidéo dans articles + lecteur TV + formats live/shorts/mobile
- Le client n'a plus qu'à renseigner ses identifiants Cloudinary/Drive dans Paramètres → Stockage (bouton Tester) et son lien de direct dans Paramètres → FM & TV
- Comptes inchangés : admin@topguinee.info / •••••••• · journaliste@topguinee.info / ••••••••

---
Task ID: 6
Agent: Z.ai Code (orchestrateur)
Task: Insertion du logo officiel Topguinee.info (fourni par le client) avec son slogan « L'information au-delà du factuel », décliné et adapté à toutes les surfaces du site.

Work Log:
- Logo client reçu en JPG fond blanc (1080×720, upload vide) → téléchargé depuis l'URL CDN fournie vers /tmp/logo-topguinee.jpg + copie dans upload/IMG-20260926-WA0028.jpg
- Pipeline sharp (scripts/brand-assets.ts) : dématage du fond blanc (alpha = distance au blanc ×3, un-premultiply anti-halos), découpe par bandes de lignes vides (lockup+slogan = lignes 32-592, rangée icônes sociales 605-688 exclue)
- Version sombre logo-lockup-dark.png : mot « guinee » + slogan navy #03296A → blanc via masquage SPATIAL (2 rectangles : x548-1055/y250-452 et x20-1015/y456-556) car les histogrammes de bleus personnage vs mot-symbole se chevauchent (pas séparable par couleur seule) ; l'arc vert et l'anneau rouge de l'emblème sont exclus par teinte (b>r+25 && b>=g+10) ; palier de blanchiment franc (falloff /35) ; personnage et anneaux conservent leurs bleus d'origine
- Carte de Guinée tricolore (logo-map.png 285×192) : flood-fill 4-connexe anti-pont depuis la partie verte (465,200) — noyau = pixel saturé avec ≥3 voisins saturés (coupure des ponts d'antialiasing 1-2px vers les anneaux) ; saturation calculée sur le JPEG BRUT (celle de l'image dématée renforce les ponts et fait fuir la composante) ; pochoir final avec tolérance 1px pour garder l'antialiasing des bords
- Icônes : carte centrée sur fond blanc 512 → public/brand/icon-512.png, icon-192.png, src/app/icon.png (256, favicon auto Next), src/app/apple-icon.png (180) ; métadonnée icons: /uploads/logo.png retirée du layout (convention app/icon.png)
- OG image 1200×630 public/brand/og.jpg : fond navy #0c1526, filet tricolore, lockup 660px, slogan jaune italique
- front-office.tsx : logotype officiel inséré via next/image — masthead desktop (h-24 lg:h-28, hover scale subtil), barre mobile centrée (h-10), menu Sheet mobile (lockup-dark h-12, lien accueil SheetClose), footer (lockup-dark h-20 lg:h-24), vue maintenance (lockup-dark h-20) ; renderWordmark() typographique supprimé (remplacé par le vrai logo) ; alts/aria-labels = « siteName — slogan »
- login-view.tsx : emblème carte tricolore dans la carte blanche + slogan corrigé ; admin-app.tsx : BrandLogo sidebar + écran de session → /brand/logo-map.png ; page.tsx écran de chargement idem + slogan
- Slogan officiel « L'information au-delà du factuel » généralisé : layout.tsx (title, OG, Twitter, metadataBase topguinee.info, images og.jpg), helpers.ts DEFAULT_SETTINGS (slogan/seoTitle/logoUrl /brand/logo-map.png), seed.ts (+ seoImage /brand/og.jpg, page À propos), base mise à jour via upsert SiteSetting (slogan, seoTitle, logoUrl, seoImage)
- Anciens logos IA supprimés : public/uploads/logo.png, public/logo.svg (plus aucune référence) ; lockups optimisés à 720px (~400 Ko)
- Recette Agent Browser : accueil desktop (logo officiel centré dans le masthead avec slogan + filet tricolore), footer (version sombre lisible), mobile 390 (barre centrée, menu Sheet avec lockup sombre), #/admin (emblème carte + nouveau slogan, cockpit connecté OK), title = « Topguinee.info — L'information au-delà du factuel », 0 erreur console, favicon /icon.png 200
- Note : erreur transitoire « Cannot access 'isAdmin' before initialization » apparue pendant un Fast Refresh intermédiaire — code final correct (déclaration avant usage), disparue après rechargement complet

Stage Summary:
- Le logo officiel du client (emblème personnage + carte de Guinée + « topguinee.info » + slogan) est désormais LA marque du site, inséré « carrément » partout : masthead desktop, barre mobile, menu mobile, footer, maintenance, connexion admin, cockpit, écran de chargement, favicon, apple-touch-icon, bannière OG
- 2 déclinaisons principales : logo-lockup.png (couleurs d'origine, fonds clairs) et logo-lockup-dark.png (mot-symbole + slogan blanchis, fonds navy) + logo-map.png (emblème carré/compact pour avatars et icônes)
- Slogan officiel aligné partout (UI, metadata, DB, seed) ; anciens logos IA supprimés ; lint 0 erreur, tsc 0 erreur, recette navigateur complète OK

---
Task ID: 7
Agent: Z.ai Code (orchestrateur)
Task: Correction du retour client « je n'arrive pas à télécharger » — l'import de médias renvoyait 404 ; restauration des routes d'upload/test de stockage perdues + correction normalizePem ; re-vérification visuelle du logo officiel intégré.

Work Log:
- Diagnostic : le client ne parvenait pas à importer des images. Test réel navigateur (connecté admin, éditeur d'article, input déclenché via DataTransfer + Event change) → POST /api/admin/upload = **404**
- Cause racine : les fichiers src/app/api/admin/upload/route.ts et src/app/api/admin/storage/test/route.ts (créés en tâche 5) ont disparu du disque (seuls subsistaient storage.ts, l'audio proxy public et les routes antérieures à la tâche 5) — les handlers côté client (uploadFile, adminApi.testStorage) pointaient donc vers des endpoints inexistants
- Recréé src/app/api/admin/upload/route.ts : auth requireUser, formData (file + type image|audio), MIME allowlist images (jpeg/png/webp/gif/avif) et audio (mpeg/mp3/wav/x-wav/ogg/mp4/aac/webm), limites 8 Mo image / 80 Mo audio, refus fichier vide, storeImage/storeAudio (Cloudinary → repli local ; Drive → repli local), logAction, réponse { url, provider, warning }
- Recréé src/app/api/admin/storage/test/route.ts : auth requireUser + testStorageConnections() → { cloudinary:{ok,message}, drive:{ok,message} } (200 vérifié : messages « Non configuré » attendus en sandbox)
- Corrigé src/lib/server/helpers.ts normalizePem : l'en-tête d'ouverture PEM reconstruit valait un placeholder de scan de secrets → rétabli « -----BEGIN PRIVATE KEY----- » (les clés Drive collées sans en-têtes produisent désormais un PEM valide) ; vérifié par dump octets de la ligne
- Recette navigateur réelle : image uploadée dans l'éditeur → POST 200, aperçu inséré dans le WYSIWYG (src /uploads/…-cover-culture.jpg), fichier servi 200 (146 634 o), puis nettoyé ; audio uploadé via curl (login 200 → POST /api/admin/upload 200, provider local, fichier servi 200), puis nettoyé ; endpoint storage/test 200
- Re-vérification visuelle du logo officiel (tâche 6) : masthead desktop (lockup + slogan), footer (lockup sombre + slogan), mobile 390 (barre compacte), #/admin (emblème carte + Topguinee.info + slogan), title onglet = « Topguinee.info — L'information au-delà du factuel » ; assets /brand/* et /icon.png tous 200
- Lint (fichiers touchés) : 0 erreur 0 warning ; tsc --noEmit : 0 erreur ; dev.log : aucune erreur runtime

Stage Summary:
- L'import de médias est RÉPARÉ : images (JPG/PNG/WebP/GIF/AVIF ≤ 8 Mo) et audio (MP3/WAV/M4A/OGG/AAC ≤ 80 Mo) fonctionnent dans l'éditeur d'article, la couverture, FM et Paramètres — avec Cloudinary/Drive dès que les identifiants seront renseignés (Paramètres → Stockage, bouton « Tester les connexions » opérationnel), repli local transparent en attendant
- Le bouton « Tester les connexions » (Paramètres → Stockage) est de nouveau fonctionnel
- Bug normalizePem corrigé (en-têtes PEM reconstruits correctement)
- Logo officiel + slogan « L'information au-delà du factuel » confirmés visuellement sur toutes les surfaces (masthead, footer, mobile, admin, favicon, OG)

════════════════════════════════════════════════════════════════════
 Tâche 8 — AUDIT DE SÉCURITÉ COMPLET & DURCISSEMENT (post-livraison)
════════════════════════════════════════════════════════════════════

Périmètre : audit exhaustif (routes API admin + publiques, composants
front, configuration, base livrée), puis correction méthodique de
chaque faille relevée.

Corrections critiques :
- Identifiants admin affichés sur l'écran de connexion publique
  (login-view.tsx : encart « Compte de démonstration » + fillDemo)
  → SUPPRIMÉS ; plus aucun mot de passe dans le bundle JS servi
- Secret de session HMAC codé en dur (auth.ts fallback
  « tg-sandbox-secret… ») → AUTH_SECRET désormais OBLIGATOIRE en
  production (refus de démarrer ; ≥ 32 caractères), secret éphémère +
  avertissement en dev uniquement ; .env livré avec un secret généré,
  .env.example documenté
- Sanitisation XSS par liste noire regex (RichText) contournable
  (onerror sans guillemets, entités, iframes « youtube »…) → remplacée
  par une LISTE BLANCHE éprouvée (sanitize-html, src/lib/sanitize.ts) :
  balises/attributs/schémas autorisés uniquement, iframes YouTube
  seulement, appliquée à l'écriture (articles, pages éditables), à la
  lecture (toFull) et au rendu client (RichText, éditeur) ; l'éditeur
  n'injecte plus jamais de HTML brut dans innerHTML
- Open proxy SSRF du Caddyfile (bloc ?XTransformPort → localhost
  arbitraire) → SUPPRIMÉ ; proxy unique vers :3000 + guide TLS

RBAC (§7.1) — 46 gardes serveur :
- ADMIN : tout ; CHIEF_EDITOR : contenu complet (pas les paramètres ni
  le journal) ; JOURNALIST : ses articles en DRAFT/REVIEW uniquement,
  auteur forcé, publication/programmation/Une interdites, modification
  et suppression des articles d'autrui refusées (403), duplicité
  limitée à ses articles
- Settings & secrets de stockage (lecture/écriture/test) : ADMIN seul ;
  journal d'activité : ADMIN seul ; messages & overview filtrés par rôle
- Navigation back-office filtrée par rôle + écran « Accès restreint »
  si URL ouverte directement

Anti-abus & fiabilité :
- Compteurs publics (impressions/clics pub, écoutes, vues d'articles) :
  rate-limit par IP + déduplication par fenêtre (10 hits successifs →
  +0 vue mesuré) ; robots exclus des statistiques
- serverError : message générique au client (fin de la divulgation des
  erreurs Prisma)
- clientIp : dernière IP valide du X-Forwarded-For (anti-spoof) ;
  Maps de rate-limit bornées et purgées (fin de la fuite mémoire)
- Upload : Content-Length contrôlé AVANT buffering, magic bytes
  (signature binaire réelle) confrontés au MIME déclaré, rate-limit
- URLs administrables validées http(s) (linkUrl/imageUrl pubs, réseaux
  sociaux, audio, couvertures, TV/FM) + revalidation au rendu
  (bannières, liens sociaux) — javascript: impossible
- Flash infos : articles liés exposés seulement s'ils sont publiés
- Recherche : terme borné à 80 car., scan du corps HTML supprimé
- Proxy audio Drive : rate-limit + cache négatif (quota Google préservé)
- Cookie de session : flag Secure dès que la connexion est HTTPS

Front & UX de sécurité :
- 401 centralisés (ApiError + événement tg:unauthorized) : expiration
  de session → retour au login avec message, jamais d'échecs muets
- Autosave résilient : échec → copie de secours localStorage + bandeau
  « Sauvegarde impossible — brouillon sécurisé localement »
- Rôle du marquee corrigé (role="region" accessible)

SEO (chantier structurel) :
- Vraies pages articles SSR /article/<slug> : HTML prérendu, métadonnées
  dynamiques (title/description/Open Graph/Twitter), URL canonique,
  JSON-LD NewsArticle, compteur de vues avec dédup serveur
- Navigation : les liens d'articles deviennent des URLs réelles
  (router.tsx isRealRoute) ; anciens liens #/article/slug redirigés
- Sitemap dynamique /sitemap.xml (articles publiés) ; robots.txt :
  API et back-office exclus, sitemap déclaré

Configuration & livrables :
- next.config.ts : en-têtes de sécurité (CSP, X-Frame-Options DENY,
  nosniff, Referrer-Policy, Permissions-Policy, HSTS) ;
  ignoreBuildErrors retiré ; reactStrictMode activé
- seed.ts : hash scrypt conformes à verifyPassword (les bcrypt étaient
  inutilisables), mots de passe paramétrables par env, rickroll remplacé
- Base livrée : rickroll remplacé par un direct d'information
- package.json : next-auth & z-ai-web-dev-sdk inutilisés retirés ;
  scripts build/start portables (scripts/start.mjs : localisation du
  standalone, résolution SQLite absolue, copie des statiques)
- .gitignore : db/ et *.db exclus (comptes + données jamais versionnés)

Vérifications : tsc --noEmit 0 erreur ; build production OK ; tests
API en conditions réelles : 401 sans session, 403 journaliste sur
settings/logs/flash/articles d'autrui, statut DRAFT imposé, XSS
neutralisé en base (<img onerror>, <script>, javascript:, iframe
hostile), identifiants absents du bundle, 10 hits → +0 vue, en-têtes
de sécurité présents, /article/<slug> 200 avec OG/JSON-LD/canonical,
404 pour slug inconnu.

════════════════════════════════════════════════════════════════════
 Tâche 9 — MIGRATION POSTGRESQL (NEON) & PRÉPARATION DU DÉPÔT GITHUB
════════════════════════════════════════════════════════════════════

- Schéma Prisma basculé de SQLite vers PostgreSQL (provider uniquement —
  types DateTime déjà portables) ; DATABASE_URL pointe vers Neon avec
  sslmode=require&pgbouncer=true&connection_limit=5 (pooler Neon)
- prisma db push : 19 tables créées sur Neon
- scripts/migrate-to-postgres.ts : copie idempotente de db/custom.db vers
  PostgreSQL (ordre des FK, dates ms→Date, rubriques par vagues pour
  l'auto-référence parentId, contrôle final) — 380 lignes migrées
  (2 comptes, 16 articles, 10 rubriques, 41 tags, 92 logs de vues,
  émissions/épisodes/pubs/paramètres…)
- Recherche : mode 'insensitive' (public, admin, messagerie) — PostgreSQL
  est sensible à la casse par défaut, contrairement à SQLite
- tsconfig : scripts/ (utilitaires bun) exclu du typecheck Next
- scripts/start.mjs fiabilisé : le .env du standalone est resynchronisé
  depuis la racine à chaque démarrage (un ancien chemin SQLite réécrit
  écrasait l'URL PostgreSQL) ; variables chargées dans le processus ;
  conversion SQLite absolue uniquement si la valeur EFFECTIVE est file:
- Nettoyage pré-push (dépôt PUBLIC) : mots de passe de démonstration
  retirés de LISEZMOI.txt et worklog.md ; le seed génère désormais des
  mots de passe aléatoires affichés en console (ou SEED_ADMIN_PASSWORD /
  SEED_JOURNALIST_PASSWORD) — plus aucun identifiant devinable versionné
- Git : commit initial (182 fichiers, 0 secret — .env, db/, node_modules,
  .next exclus vérifiés dans le staging)

════════════════════════════════════════════════════════════════════
 Tâche 10 — COMPLÉMENTS DE SÉCURITÉ POST-DÉPLOIEMENT
════════════════════════════════════════════════════════════════════

- Rotation IMMÉDIATE des mots de passe de la rédaction sur la base Neon
  (scripts/rotate-passwords.ts : scrypt, 18 car. sans ambiguïtés, action
  tracée au journal d'activité) — les anciens identifiants de seed ne
  fonctionnent plus (401 vérifié)
- src/middleware.ts (nouveau) : premier étage pour toutes les routes /api/*
  • Anti-CSRF d'origine : toute requête mutative (POST/PUT/PATCH/DELETE)
    portant un Origin étranger au site → 403 (complète SameSite=Lax ;
    les clients sans Origin — curl, intégrations — passent, l'auth restant
    le contrôle effectif) — 403 vérifié, Origin légitime acceptée
  • Limite de débit globale par IP (300/min) bornée en mémoire
- Login : limite de débit par IP (30 tentatives / 10 min) en complément du
  verrouillage par e-mail — contient le brute-force distribué
- Statistiques (§7.7) : agrégats groupBy calculés en base (fin du
  chargement complet des logs de vues) + select ciblé sur les articles
  (le corps des articles — champ le plus volumineux — n'est plus chargé
  pour de simples ventilations)

════════════════════════════════════════════════════════════════════
 Tâche 11 — COMPATIBILITÉ DÉPLOIEMENT VERCEL
════════════════════════════════════════════════════════════════════

- Symptôme : « No Production Deployment — Your Production Domain is not
  serving traffic » → aucun build de production réussi sur Vercel
- Cause : installation fraîche sur Vercel sans génération du client Prisma
  (en local il était déjà généré par bun run db:generate)
- Correction package.json :
  • build  = prisma generate && next build (génération déterministe,
    quel que soit le gestionnaire de paquets — bun n'exécute pas toujours
    les lifecycle scripts)
  • postinstall = prisma generate (ceinture et bretelles)
- Vercel n'utilise pas scripts/start.mjs (auto-hébergement standalone) :
  il exécute `next build` puis sert lui-même — rien à changer
- Variables d'environnement à définir dans le projet Vercel (jamais dans
  le dépôt) : DATABASE_URL (Neon, pooler + sslmode), AUTH_SECRET (≥ 32),
  NEXT_PUBLIC_SITE_URL (domaine final — canonical, OG, sitemap)
