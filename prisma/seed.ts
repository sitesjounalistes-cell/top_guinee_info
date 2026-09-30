/* Seed Topguinee.info — contenu de lancement réaliste */
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Même schéma que src/lib/auth.ts (scrypt salé) — un hash bcrypt serait
// rejeté par verifyPassword.
// Dépôt PUBLIC : aucun mot de passe par défaut devinable dans le code.
// Les mots de passe initiaux viennent de l'environnement
// (SEED_ADMIN_PASSWORD / SEED_JOURNALIST_PASSWORD) ; à défaut, un mot de
// passe aléatoire est généré et affiché une seule fois en console.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${key}`
}

function initialPassword(envVar: string, label: string): string {
  const fromEnv = process.env[envVar]
  if (fromEnv && fromEnv.length >= 8) return fromEnv
  const generated = crypto.randomBytes(12).toString('base64url')
  console.log(`\n🔑 ${label} — mot de passe initial généré : ${generated}`)
  console.log(`   Conservez-le maintenant (il ne sera plus affiché) ou relancez le seed`)
  console.log(`   avec ${envVar}=... pour en choisir un. À changer après la 1re connexion.\n`)
  return generated
}

const ADMIN_PASSWORD = initialPassword('SEED_ADMIN_PASSWORD', 'admin@topguinee.info')
const JOURNALIST_PASSWORD = initialPassword('SEED_JOURNALIST_PASSWORD', 'journaliste@topguinee.info')

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function daysAgo(n: number, h = 10, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return d
}
function daysAhead(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(9, 0, 0, 0)
  return d
}

async function main() {
  console.log('🌱 Nettoyage…')
  await db.activityLog.deleteMany()
  await db.articleViewLog.deleteMany()
  await db.episode.deleteMany()
  await db.emission.deleteMany()
  await db.adCampaign.deleteMany()
  await db.advertiser.deleteMany()
  await db.adSlot.deleteMany()
  await db.flashInfo.deleteMany()
  await db.contactMessage.deleteMany()
  await db.contactChannel.deleteMany()
  await db.socialLink.deleteMany()
  await db.articleTag.deleteMany()
  await db.tag.deleteMany()
  await db.media.deleteMany()
  await db.editablePage.deleteMany()
  await db.siteSetting.deleteMany()
  await db.article.deleteMany()
  await db.rubrique.deleteMany()
  await db.user.deleteMany()

  // ─── Utilisateurs ───────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      name: 'Rédaction Topguinee',
      email: 'admin@topguinee.info',
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
      bio: 'Rédaction en chef de Topguinee.info',
    },
  })
  const journalist = await db.user.create({
    data: {
      name: 'Mamadou Camara',
      email: 'journaliste@topguinee.info',
      passwordHash: hashPassword(JOURNALIST_PASSWORD),
      role: 'JOURNALIST',
      bio: 'Journaliste politique — Topguinee.info',
    },
  })

  // ─── Rubriques & sous-rubriques ──────────────────────────────
  const mk = (name: string, i: number, color: string, icon: string) =>
    db.rubrique.create({ data: { name, slug: slugify(name), order: i, color, icon } })
  const politique = await mk('Politique', 1, '#D21034', 'landmark')
  const economie = await mk('Économie', 2, '#009460', 'trending-up')
  const societe = await mk('Société', 3, '#14213D', 'users')
  const sport = await mk('Sport', 4, '#FCD116', 'trophy')
  const culture = await mk('Culture', 5, '#009460', 'music')
  const international = await mk('International', 6, '#D21034', 'globe')

  await db.rubrique.create({ data: { name: 'Gouvernance', slug: 'gouvernance', parentId: politique.id, order: 1, color: '#D21034', icon: 'scale' } })
  await db.rubrique.create({ data: { name: 'Élections', slug: 'elections', parentId: politique.id, order: 2, color: '#D21034', icon: 'vote' } })
  await db.rubrique.create({ data: { name: 'Mines & Énergie', slug: 'mines-energie', parentId: economie.id, order: 1, color: '#009460', icon: 'pickaxe' } })
  await db.rubrique.create({ data: { name: 'Football', slug: 'football', parentId: sport.id, order: 1, color: '#FCD116', icon: 'goal' } })

  // ─── Articles ────────────────────────────────────────────────
  const img = (n: string) => `/uploads/${n}`
  type A = {
    title: string; subtitle: string; description: string; body: string;
    cover: string; alt: string; rub: string; sub?: string; author: string;
    days: number; views: number; tags: string[]; featured?: number;
    status?: string; scheduled?: number; youtube?: string;
  }
  const articles: A[] = [
    {
      title: 'Le Gouvernement annonce un plan national d\'électrification rurale de 500 milliards de GNF',
      subtitle: 'Deux millions de Guinéens devraient être raccordés au réseau d\'ici 2028',
      description: 'Le Premier ministre a présenté mardi le plan Sénéka Énergie, un programme inédit d\'électrification rurale financé par un consortium international.',
      body: `<p>Le gouvernement guinéen a dévoilé mardi, au Palais du Peuple de <strong>Conakry</strong>, un plan national d'électrification rurale doté d'un budget de <strong>500 milliards de francs guinéens</strong> (environ 58 millions de dollars). Baptisé « Sénéka Énergie », le programme vise à raccorder deux millions de foyers au réseau électrique national d'ici 2028.</p>
<h2>Un financement inédit</h2>
<p>Le financement repose sur un consortium réunissant la Banque mondiale, la Banque africaine de développement et plusieurs bailleurs bilatéraux. « L'électricité n'est plus un luxe, c'est le socle de notre souveraineté économique », a déclaré le Premier ministre devant la presse.</p>
<blockquote>« L'électricité n'est plus un luxe, c'est le socle de notre souveraineté économique » — Premier ministre</blockquote>
<h2>Les régions prioritaires</h2>
<ul>
<li>La Guinée forestière, avec 400 localités ciblées dès la première phase</li>
<li>La Moyenne-Guinée, via le développement de mini-centrales solaires</li>
<li>La Haute-Guinée, adossée au réseau du complexe hydroélectrique de Kaleta</li>
</ul>
<p>Les travaux, dont le lancement est prévu au premier trimestre, devraient générer plus de <em>15 000 emplois directs</em> selon le ministère de l'Énergie. Les associations de la société civile saluent l'initiative tout en appelant à la transparence dans l'attribution des marchés.</p>
<p>Topguinee.info reviendra en détail sur ce programme dans une prochaine édition spéciale.</p>`,
      cover: img('cover-economie.jpg'), alt: 'Chantier d\'électrification rurale en Guinée',
      rub: 'economie', sub: 'mines-energie', author: 'admin', days: 0, views: 4210, tags: ['Énergie', 'Gouvernement', 'Développement'], featured: 1,
    },
    {
      title: 'Les Syli Nationale qualifiés pour la CAN 2027 après un match historique',
      subtitle: 'Victoire 3-1 face au Sénégal dans un stade Général Lansana Conté en fusion',
      description: 'Le football guinéen vit un moment historique : les Syli battent le Sénégal et décrochent leur billet pour la CAN 2027.',
      body: `<p>C'était la soirée que tout un pays attendait. Les <strong>Syli Nationale</strong> ont battu le Sénégal <strong>3 buts à 1</strong> ce samedi soir au stade Général Lansana Conté, décrochant leur qualification pour la <strong>CAN 2027</strong> qui se jouera sur le sol guinéen.</p>
<h2>Un match entré dans l'histoire</h2>
<p>Ouverte par une frappe lointaine de Naby Keïta à la 23<sup>e</sup> minute, la rencontre a basculé en seconde période grâce à un doublé de Serhou Guirassy. La réduction du score sénégalaise en fin de match n'a rien changé à l'essentiel.</p>
<h2>Réactions</h2>
<p>« Ce groupe a écrit une page magnifique de l'histoire du football guinéen », a lancé le sélectionneur au micro de <em>Topguinee FM</em>. Dans les rues de Conakry, la fête a duré jusqu'au petit matin.</p>
<p>La Guinée rejoindra 23 autres sélections pour le tournoi continental, dont elle sera l'un des pays hôtes.</p>`,
      cover: img('cover-sport.jpg'), alt: 'Stade de football en Guinée',
      rub: 'sport', sub: 'football', author: 'journalist', days: 0, views: 6832, tags: ['Football', 'CAN 2027', 'Syli Nationale'], featured: 2,
      youtube: 'https://www.youtube.com/watch?v=YDvsBbKfLPA',
    },
    {
      title: 'Bauxite : la Guinée confirme sa place de premier exportateur mondial',
      subtitle: 'Les exportations ont progressé de 12 % sur le premier semestre',
      description: 'Le ministère des Mines publie des chiffres record pour le secteur minier, pilier de l\'économie nationale.',
      body: `<p>Le ministère des Mines et de la Géologie a publié cette semaine un bilan semestriel exceptionnel : les exportations de <strong>bauxite</strong> ont atteint <strong>72 millions de tonnes</strong>, en hausse de 12 % par rapport à la même période l'an dernier.</p>
<h2>Un pilier de l'économie</h2>
<p>La Guinée concentre à elle seule près des deux tiers des réserves mondiales de bauxite. Le secteur représente désormais plus de 80 % des recettes d'exportation du pays.</p>
<h2>Les défis de la transformation locale</h2>
<p>Les autorités insistent sur la nécessité d'aller vers une <em>transformation locale</em> du minerai. Un nouveau code minier, en discussion, prévoit des obligations renforcées d'aluminiumerie sur le sol national.</p>
<ul>
<li>72 millions de tonnes exportées au S1</li>
<li>+12 % de croissance sectorielle</li>
<li>3 nouveaux projets d'aluminiumerie à l'étude</li>
</ul>`,
      cover: img('cover-economie.jpg'), alt: 'Mine de bauxite en Guinée',
      rub: 'economie', sub: 'mines-energie', author: 'journalist', days: 1, views: 2874, tags: ['Bauxite', 'Mines', 'Export'],
    },
    {
      title: 'Festival National des Arts : Conakry célèbre trois jours de culture guinéenne',
      subtitle: 'Danse, griots, tissage et cinema au programme de la 14e édition',
      description: 'La 14e édition du Festival National des Arts s\'est ouverte jeudi à Conakry avec plus de 300 artistes de toutes les régions.',
      body: `<p>Tambours allumés, voix des griots, tissage de Siguiri : la <strong>14<sup>e</sup> édition du Festival National des Arts</strong> a ouvert ses portes jeudi soir au Palais du Peuple, devant plusieurs milliers de spectateurs.</p>
<h2>Un patrimoine vivant</h2>
<p>Pendant trois jours, plus de <strong>300 artistes</strong> issus des quatre régions naturelles présentent leur travail : ballets traditionnels, contes, poésie, mode et cinéma. Le Nigeria, invité d'honneur, est représenté par une délégation culturelle de 40 personnes.</p>
<blockquote>« Notre culture est notre plus grande richesse, plus précieuse que le bauxite » — Ministre de la Culture</blockquote>
<p>Les spectacles se poursuivent jusqu'à dimanche, avec une clôture au stade du 28 Septembre.</p>`,
      cover: img('cover-culture.jpg'), alt: 'Tambours traditionnels guinéens',
      rub: 'culture', author: 'admin', days: 2, views: 1523, tags: ['Culture', 'Festival', 'Traditions'],
    },
    {
      title: 'Dialogue national : les recommandations remises au Chef de l\'État',
      subtitle: 'Le Comité de facilitation a rendu son rapport après six mois de consultations',
      description: 'Le rapport final du dialogue national, remis ce lundi, formule 80 recommandations pour la transition démocratique.',
      body: `<p>Le comité de facilitation du <strong>dialogue national inter-guinéen</strong> a remis lundi matin son rapport final au Chef de l'État, au terme de six mois de consultations dans les huit régions administratives du pays.</p>
<h2>80 recommandations</h2>
<p>Le document formule <strong>80 recommandations</strong> touchant à la justice transitionnelle, à la réforme électorale, à la décentralisation et à l'éducation citoyenne. Les organisations de jeunesse et de femmes, largement consultées, y voient « une base de travail sérieuse ».</p>
<h2>Prochaines étapes</h2>
<p>Le gouvernement disposera de 30 jours pour indiquer les suites qu'il compte réserver à chaque axe du rapport, selon le calendrier annoncé.</p>`,
      cover: img('cover-politique.jpg'), alt: 'Palais présidentiel de Conakry',
      rub: 'politique', sub: 'gouvernance', author: 'journalist', days: 2, views: 3390, tags: ['Politique', 'Transition', 'Dialogue'],
    },
    {
      title: 'Santé : ouverture de deux nouveaux centres de référence à Kindia et Kankan',
      subtitle: 'Une capacité additionnelle de 240 lits pour les régions intérieures',
      description: 'Le ministère de la Santé inaugure deux centres de santé de référence dotés d\'équipements de diagnostic moderne.',
      body: `<p>Le ministère de la Santé et de l'Hygiène publique a inauguré cette semaine deux <strong>centres de santé de référence</strong> à Kindia et Kankan, dotés d'une capacité totale de 240 lits.</p>
<h2>Des équipements modernes</h2>
<p>Chaque centre abrite un plateau d'imagerie (radiologie, échographie), un laboratoire d'analyses et une maternité rénovée. La formation du personnel — 180 agents au total — a été assurée en partenariat avec l'Université Gamal Abdel Nasser de Conakry.</p>
<p>« Ces infrastructures réduiront considérablement les évacuations sanitaires vers la capitale », s'est félicité le directeur régional de la santé de Kankan.</p>`,
      cover: img('cover-sante.jpg'), alt: 'Centre de santé en Guinée',
      rub: 'societe', author: 'admin', days: 3, views: 1980, tags: ['Santé', 'Infrastructures', 'Kindia', 'Kankan'],
    },
    {
      title: 'Sommet de l\'UA : la Guinée plaide pour un siège permanent de l\'Afrique au Conseil de sécurité',
      subtitle: 'Discours attendu du chef de la délégation guinéenne à Addis-Abeba',
      description: 'Le chef de l\'État guinéen participe au sommet de l\'Union africaine où la réforme du Conseil de sécurité de l\'ONU est au cœur des débats.',
      body: `<p>Le sommet ordinaire de l'<strong>Union africaine</strong> s'est ouvert ce week-end à Addis-Abeba, avec en toile de fond la question de la <strong>réforme du Conseil de sécurité</strong> des Nations unies.</p>
<h2>La voix de la Guinée</h2>
<p>La délégation guinéenne, conduite par le ministre des Affaires étrangères, a plaidé pour « une représentation permanente et légitime de l'Afrique au sein des instances de décision mondiales ».</p>
<h2>Intégration régionale</h2>
<p>Un second axe guinéen porte sur l'accélération de la <strong>ZLECAf</strong>, la zone de libre-échange continentale africaine, perçue comme un levier majeur pour les exportations guinéennes.</p>`,
      cover: img('cover-international.jpg'), alt: 'Salle de l\'Union africaine',
      rub: 'international', author: 'admin', days: 4, views: 1240, tags: ['UA', 'Diplomatie', 'Afrique'],
    },
    {
      title: 'Port de Conakry : record de trafic conteneurisé au premier trimestre',
      subtitle: 'Le trafic a progressé de 18 % grâce aux nouveaux portiques automatiques',
      description: 'L\'Autorité Portuaire annonce un trimestre record avec la mise en service des nouveaux équipements de manutention.',
      body: `<p>L'Autorité Portuaire de Conakry annonce un <strong>record de trafic conteneurisé</strong> pour le premier trimestre, avec une progression de <strong>18 %</strong> par rapport à l'année précédente.</p>
<h2>Modernisation en marche</h2>
<p>La mise en service de six nouveaux portiques automatiques et du système de guichet numérique pour les transitaires a divisé par deux les délais d'escale.</p>
<ul>
<li>145 000 EVP manipulés sur le trimestre</li>
<li>Délai moyen d'escale ramené à 3,2 jours</li>
<li>Investissement de 120 millions de dollars</li>
</ul>`,
      cover: img('cover-une.jpg'), alt: 'Port de Conakry',
      rub: 'economie', author: 'journalist', days: 5, views: 1670, tags: ['Port', 'Commerce', 'Conakry'],
    },
    {
      title: 'Éducation : les examens nationaux se tiendront du 10 au 26 juin',
      subtitle: 'Plus de 300 000 candidats attendus pour le BAC, le BEPC et l\'entrée en 7e année',
      description: 'Le calendrier officiel des examens scolaires 2026 a été publié par le ministère de l\'Éducation.',
      body: `<p>Le ministère de l'Éducation nationale a rendu public le <strong>calendrier officiel des examens nationaux</strong> : le baccalauréat s'ouvrira le 10 juin, suivi du BEPC puis de l'examen d'entrée en 7<sup>e</sup> année.</p>
<h2>300 000 candidats</h2>
<p>Plus de <strong>300 000 candidats</strong> sont inscrits sur l'ensemble du territoire, un chiffre en hausse constante qui traduit la scolarisation croissante, notamment des jeunes filles.</p>
<p>Le ministre a appelé les chefs d'établissement à garantir « des conditions d'organisation irréprochables ».</p>`,
      cover: img('cover-education.jpg'), alt: 'Élèves guinéens en classe',
      rub: 'societe', author: 'journalist', days: 6, views: 2210, tags: ['Éducation', 'Examens', 'Jeunesse'],
    },
    {
      title: 'Chronique : ce que change la nouvelle loi sur la presse',
      subtitle: 'Analyse d\'un texte attendu depuis dix ans par les professionnels des médias',
      description: 'La nouvelle loi sur la presse apporte des garanties inédites pour la protection des sources journalistiques. Analyse.',
      body: `<p>Adoptée il y a quelques semaines, la <strong>nouvelle loi sur la presse</strong> suscite un débat nourri au sein de la profession. <em>Topguinee.info</em> en analyse les apports et les zones d'ombre.</p>
<h2>Les avancées</h2>
<p>Le texte consacre enfin la <strong>protection des sources</strong> et crée un statut fiscal spécifique pour les entreprises de presse, longtemps réclamé par les éditeurs.</p>
<h2>Les interrogations</h2>
<p>En revanche, la question de la répartition des supports publicitaires publics reste floue, de même que le régime des sanctions. La Haute Autorité de la Communication doit publier ses décrets d'application d'ici l'été.</p>
<blockquote>« Une loi imparfaite mais un pas décisif pour le pluralisme » — Fédération des médias indépendants</blockquote>`,
      cover: img('cover-redaction.jpg'), alt: 'Salle de rédaction',
      rub: 'politique', author: 'admin', days: 7, views: 980, tags: ['Presse', 'Loi', 'Médias'],
      youtube: 'https://www.youtube.com/watch?v=YDvsBbKfLPA',
    },
    {
      title: 'Basket-ball : la Ligue de Conakry lance sa saison avec 12 équipes',
      subtitle: 'Le championnat s\'ouvre samedi au palais des sports du 28 Septembre',
      description: 'La Ligue régionale de basket de Conakry dévoile son calendrier et ses ambitions pour la saison 2026.',
      body: `<p>La <strong>Ligue régionale de basket-ball de Conakry</strong> a présenté sa saison 2026 : douze équipes masculines et huit formations féminines s'affronteront au palais des sports du 28 Septembre.</p>
<h2>Des ambitions continentales</h2>
<p>Le club tenant du titre annonce l'arrivée de deux internationaux et vise la <strong>Road to BAL</strong>, le pré-qualificatif de la Ligue africaine de basket-ball.</p>`,
      cover: img('cover-sport.jpg'), alt: 'Match de basket en Guinée',
      rub: 'sport', author: 'journalist', days: 8, views: 760, tags: ['Basket-ball', 'Ligue', 'Conakry'],
    },
    {
      title: 'Météo : la Direction nationale anticipe une saison pluvieuse intense',
      subtitle: 'Un dispositif d\'alerte précoce renforcé pour les régions côtières',
      description: 'La Direction nationale de la météorologie prévoit des précipitations supérieures de 20 % à la normale cette saison.',
      body: `<p>La <strong>Direction nationale de la météorologie</strong> prévoit pour la saison des pluies des précipitations <strong>supérieures de 20 % à la moyenne</strong> des dix dernières années, en particulier sur la bande côtière.</p>
<h2>Alerte précoce renforcée</h2>
<p>Un dispositif d'alerte par SMS et radios communautaires sera activé dès le mois de mai, avec des bulletins quotidiens en langue nationale diffusés sur <em>Topguinee FM</em>.</p>`,
      cover: img('cover-une.jpg'), alt: 'Saison des pluies à Conakry',
      rub: 'societe', author: 'admin', days: 9, views: 540, tags: ['Météo', 'Prévision', 'Alerte'],
    },
    // Brouillon + relecture pour la démo back-office
    {
      title: 'Kandé : le nouveau complexe solaire de 60 MW entrera en service en septembre',
      subtitle: 'Reportage en préparation sur le chantier du plus grand parc solaire du pays',
      description: 'Notre reportage sur le complexe solaire de Kandé, qui doublera la capacité de production solaire nationale.',
      body: `<p>Sur le site de <strong>Kandé</strong>, à une cinquantaine de kilomètres de Conakry, les travaux du plus grand <strong>parc solaire</strong> du pays avancent à grand pas. 60 mégawatts supplémentaires alimenteront le réseau national dès septembre.</p>
<h2>Reportage</h2>
<p>Notre équipe est allée à la rencontre des ingénieurs et des ouvriers du chantier. Publication prévue cette semaine.</p>`,
      cover: img('cover-economie.jpg'), alt: 'Panneaux solaires en Guinée',
      rub: 'economie', sub: 'mines-energie', author: 'journalist', days: 0, views: 0, tags: ['Solaire', 'Énergie'], status: 'DRAFT',
    },
    {
      title: 'Interview exclusive : la Ministre du Plan détaille la feuille de route 2030',
      subtitle: 'Croissance inclusive, industrialisation et capital humain au menu de l\'entretien',
      description: 'Entretien exclusif avec la Ministre du Plan et de la Coopération internationale sur les grands axes de la vision 2030.',
      body: `<p>Dans un entretien exclusif accordé à <em>Topguinee.info</em>, la <strong>Ministre du Plan et de la Coopération internationale</strong> détaille les axes de la vision nationale 2030.</p>
<h2>Trois priorités</h2>
<p>Croissance inclusive, industrialisation des matières premières et investissement dans le capital humain : la feuille de route s'articule autour de trois piliers, explique la ministre.</p>
<p>Propos à lire intégralement dans notre édition de ce week-end.</p>`,
      cover: img('cover-politique.jpg'), alt: 'Portrait officiel',
      rub: 'politique', author: 'admin', days: 0, views: 0, tags: ['Interview', 'Vision 2030'], status: 'REVIEW',
    },
    // Article programmé
    {
      title: 'Communiqué : le calendrier des célébrations de l\'indépendance dévoilé',
      subtitle: 'Défilé militaire, gala culturel et concerts gratuits à Conakry',
      description: 'Le comité national d\'organisation publie le programme officiel des festivités du 2 octobre.',
      body: `<p>Le comité national d'organisation a dévoilé le programme officiel des <strong>célébrations de l'indépendance</strong> : défilé militaire le matin sur l'avenue de la République, gala culturel au Palais du Peuple et concerts gratuits sur les places publiques.</p>
<p>Ce communiqué sera mis en ligne au moment voulu.</p>`,
      cover: img('cover-culture.jpg'), alt: 'Festivités nationales',
      rub: 'culture', author: 'admin', days: 0, views: 0, tags: ['Indépendance', 'Fête nationale'], status: 'PUBLISHED', scheduled: 5,
    },
  ]

  const created: Record<string, { id: string; title: string }> = {}
  for (const a of articles) {
    const rub = await db.rubrique.findUnique({ where: { slug: a.rub } })
    if (!rub) continue
    let subId: string | undefined
    if (a.sub) {
      const sub = await db.rubrique.findUnique({ where: { slug: a.sub } })
      subId = sub?.id
    }
    const published = a.scheduled ? daysAhead(a.scheduled) : daysAgo(a.days, 9 + (a.days % 8), (a.days * 7) % 60)
    const art = await db.article.create({
      data: {
        title: a.title,
        subtitle: a.subtitle,
        description: a.description,
        body: a.body,
        slug: slugify(a.title),
        coverImage: a.cover,
        coverAlt: a.alt,
        rubriqueId: rub.id,
        subRubriqueId: subId,
        authorId: a.author === 'admin' ? admin.id : journalist.id,
        status: a.status ?? 'PUBLISHED',
        publishedAt: a.status === 'PUBLISHED' || a.status === 'REVIEW' || a.status === 'DRAFT' ? (a.status === 'PUBLISHED' ? published : null) : published,
        scheduledAt: a.scheduled ? daysAhead(a.scheduled) : null,
        featuredOrder: a.featured ?? null,
        views: a.views,
        readTime: Math.max(2, Math.round(a.body.length / 900)),
        youtubeUrl: a.youtube ?? null,
      },
    })
    created[a.title.slice(0, 20)] = { id: art.id, title: a.title }
    for (const t of a.tags) {
      const tag = await db.tag.upsert({
        where: { slug: slugify(t) },
        update: {},
        create: { name: t, slug: slugify(t) },
      })
      await db.articleTag.create({ data: { articleId: art.id, tagId: tag.id } })
    }
    // Journal de vues pour les stats
    if (a.views > 0) {
      for (let d = 0; d < Math.min(14, a.days + 3); d++) {
        await db.articleViewLog.create({
          data: {
            articleId: art.id,
            day: daysAgo(d).toISOString().slice(0, 10),
            count: Math.max(1, Math.round((a.views / (a.days + 3)) * (0.5 + Math.random()))),
          },
        }).catch(() => {})
      }
    }
    await db.media.create({
      data: { type: 'image', url: a.cover, alt: a.alt, articleId: art.id, meta: JSON.stringify({ w: 1344, h: 768, source: 'seed' }) },
    })
  }

  // ─── Flash Info ──────────────────────────────────────────────
  const sportArt = Object.values(created).find(c => c.title.includes('Syli'))
  const flash = [
    { text: 'URGENT : Le Gouvernement annonce un plan d\'électrification rurale de 500 milliards de GNF', priority: 3, art: created[Object.keys(created)[0]]?.id },
    { text: 'Les Syli Nationale qualifiés pour la CAN 2027 ! Victoire 3-1 face au Sénégal', priority: 2, art: sportArt?.id },
    { text: 'Trafic record au Port autonome de Conakry : +18 % au premier trimestre', priority: 1, art: undefined },
    { text: 'Examens nationaux : le calendrier officiel publié, épreuves du 10 au 26 juin', priority: 1, art: undefined },
  ]
  for (const f of flash) {
    await db.flashInfo.create({
      data: {
        text: f.text,
        articleId: f.art,
        priority: f.priority,
        isActive: true,
        publishAt: daysAgo(0, 8),
        expiresAt: daysAhead(3),
      },
    })
  }

  // ─── Émissions & épisodes ────────────────────────────────────
  const journal = await db.emission.create({
    data: {
      title: 'Le Journal Parlé',
      description: 'L\'essentiel de l\'actualité guinéenne et internationale, chaque jour à midi. 15 minutes d\'informations vérifiées, reportages et interviews.',
      coverImage: img('emission-journal.jpg'),
      type: 'PODCAST',
      order: 1,
    },
  })
  const debat = await db.emission.create({
    data: {
      title: 'Grand Débat FM',
      description: 'Le rendez-vous hebdomadaire des grandes questions : politique, économie, société. Invités en plateau et débats ouverts aux auditeurs.',
      coverImage: img('emission-debat.jpg'),
      type: 'FM',
      order: 2,
    },
  })
  const episodes = [
    { em: journal.id, title: 'Journal de midi — Plan d\'électrification et CAN 2027', desc: 'Au sommaire : le plan Sénéka Énergie, la qualification des Syli, et le bilan minier du semestre.', d: 0, dur: 892, listens: 1240 },
    { em: journal.id, title: 'Journal de midi — Dialogue national : les 80 recommandations', desc: 'Analyse du rapport final du dialogue national remis au Chef de l\'État.', d: 1, dur: 915, listens: 890 },
    { em: journal.id, title: 'Journal de midi — Examens nationaux et saison pluvieuse', desc: 'Le calendrier des examens, et le dispositif d\'alerte météo pour la saison des pluies.', d: 2, dur: 843, listens: 640 },
    { em: debat.id, title: 'Grand Débat : « Bauxite, en finir avec l\'économie d\'extraction »', desc: 'Avec Pr. Aissatou Barry (économiste) et Mamadou Sylla (ancien dirigeant minier). Débat animé par la rédaction.', d: 3, dur: 3210, listens: 2100 },
  ]
  for (const e of episodes) {
    await db.episode.create({
      data: {
        emissionId: e.em,
        title: e.title,
        description: e.desc,
        audioUrl: '/uploads/audio/sample-chronique.wav',
        duration: e.dur,
        isPublished: true,
        publishAt: daysAgo(e.d, 12),
        listens: e.listens,
      },
    })
  }

  // ─── Contacts & réseaux sociaux ──────────────────────────────
  await db.contactChannel.createMany({
    data: [
      { type: 'email', label: 'Rédaction', value: 'topguinee.info@gmail.com', order: 1 },
      { type: 'phone', label: 'Téléphone', value: '+224 621 62 63 18', order: 2 },
      { type: 'whatsapp', label: 'WhatsApp', value: '+224 664 63 90 42', order: 3 },
    ],
  })
  await db.socialLink.createMany({
    data: [
      { platform: 'facebook', url: 'https://facebook.com/share/189PtCYZ6j', order: 1 },
      { platform: 'tiktok', url: 'https://tiktok.com/@topguinee.info', order: 2 },
      { platform: 'youtube', url: 'https://youtube.com/@topguineeinfo', order: 3 },
      { platform: 'x', url: 'https://x.com/topguineeinfo', order: 4, isActive: false },
      { platform: 'instagram', url: 'https://instagram.com/topguinee.info', order: 5, isActive: false },
    ],
  })

  // ─── Publicité ───────────────────────────────────────────────
  const slots = await Promise.all([
    db.adSlot.create({ data: { name: 'Bannière Header', position: 'header', format: '728x90' } }),
    db.adSlot.create({ data: { name: 'Bannière Footer', position: 'footer', format: '728x90' } }),
    db.adSlot.create({ data: { name: 'Sidebar principale', position: 'sidebar', format: '300x250' } }),
    db.adSlot.create({ data: { name: 'Sidebar article', position: 'sidebar', format: '160x600' } }),
    db.adSlot.create({ data: { name: 'Intercalaire accueil', position: 'intercalaire', format: '728x90' } }),
    db.adSlot.create({ data: { name: 'Encart in-article', position: 'in_article', format: '300x250' } }),
  ])
  const telco = await db.advertiser.create({ data: { name: 'Orange Money Guinée', contact: 'pub@orange.gn', notes: 'Campagne mobile money T3' } })
  const bank = await db.advertiser.create({ data: { name: 'Ecobank Guinée', contact: 'marketing@ecobank.gn', notes: 'Rappel de marque annuel' } })
  await db.adCampaign.create({
    data: {
      slotId: slots[0].id, advertiserId: telco.id, title: 'Orange Money — Transfert instantané',
      imageUrl: img('pub-orange.jpg'), linkUrl: 'https://orange.gn', weight: 2,
      startDate: daysAgo(5), endDate: daysAhead(25),
      impressions: 12480, clicks: 312,
    },
  })
  await db.adCampaign.create({
    data: {
      slotId: slots[2].id, advertiserId: bank.id, title: 'Ecobank — Compte Xpress',
      imageUrl: img('pub-banque.jpg'), linkUrl: 'https://ecobank.com', weight: 1,
      startDate: daysAgo(2), endDate: daysAhead(60),
      impressions: 5230, clicks: 141,
    },
  })
  await db.adCampaign.create({
    data: {
      slotId: slots[4].id, advertiserId: telco.id, title: 'Orange — Offre Double Bonus',
      imageUrl: img('pub-orange.jpg'), linkUrl: 'https://orange.gn', weight: 1,
      startDate: daysAgo(1), endDate: daysAhead(14),
      impressions: 2140, clicks: 55,
    },
  })

  // ─── Paramètres & pages éditables ────────────────────────────
  await db.siteSetting.createMany({
    data: [
      { key: 'siteName', value: 'Topguinee.info' },
      { key: 'slogan', value: 'L\'information au-delà du factuel' },
      { key: 'fmLabel', value: 'FM' },
      { key: 'logoUrl', value: '/brand/logo-map.png' },
      { key: 'seoTitle', value: 'Topguinee.info — L\'information au-delà du factuel' },
      { key: 'seoDescription', value: 'Toute l\'actualité de la Guinée et du monde : politique, économie, société, sport, culture. Flash info en continu, podcasts et chroniques.' },
      { key: 'seoImage', value: '/brand/og.jpg' },
      { key: 'analyticsId', value: '' },
      { key: 'maintenance', value: 'off' },
      { key: 'fmEnabled', value: 'on' },
      { key: 'tvEnabled', value: 'on' },
      { key: 'tvLabel', value: 'TV' },
      // Démonstration : vidéo lisible dans le lecteur TV (à remplacer dans
      // Paramètres → FM & TV par le lien du direct YouTube/Facebook de la rédaction)
      { key: 'tvYoutubeUrl', value: 'https://www.youtube.com/watch?v=YDvsBbKfLPA' },
      { key: 'tvFacebookUrl', value: '' },
    ],
  })
  await db.editablePage.createMany({
    data: [
      {
        key: 'about',
        title: 'À propos de Topguinee.info',
        content: `<h2>Notre mission</h2>
<p><strong>Topguinee.info</strong> est un média d'information en ligne guinéen, indépendant et généraliste. Notre vocation : informer le public guinéen et la diaspora avec rigueur, réactivité et pluralisme.</p>
<h2>Notre ligne éditoriale</h2>
<p>Nous croyons à une information vérifiée, hiérarchisée et utile. Nos rubriques couvrent la politique, l'économie, la société, le sport, la culture et l'international, complétées par nos formats audio (podcasts et chroniques FM) et vidéo.</p>
<h2>L'histoire</h2>
<p>Fondée par une équipe de journalistes passionnés, la rédaction de Topguinee.info s'est donnée pour slogan « L'information au-delà du factuel » — une promesse de constance et d'exigence au service des citoyens.</p>
<h2>Nous contacter</h2>
<p>Une info, une réaction, une correction ? Écrivez-nous à topguinee.info@gmail.com ou via notre page Contact.</p>`,
      },
      {
        key: 'legal',
        title: 'Mentions légales',
        content: `<h2>Éditeur du site</h2>
<p>Topguinee.info — Média d'information en ligne.<br/>Contact : topguinee.info@gmail.com — Tél. : +224 621 62 63 18</p>
<h2>Hébergement</h2>
<p>Le site est hébergé sur une infrastructure cloud sécurisée. Les médias (images, audios) sont diffusés via des services CDN partenaires.</p>
<h2>Propriété intellectuelle</h2>
<p>L'ensemble des contenus (textes, photos, vidéos, podcasts) est protégé par le droit d'auteur. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite.</p>`,
      },
      {
        key: 'privacy',
        title: 'Politique de confidentialité',
        content: `<h2>Données collectées</h2>
<p>Le formulaire de contact recueille uniquement votre nom, votre adresse e-mail et votre message, destinés à la rédaction pour vous répondre.</p>
<h2>Mesure d'audience</h2>
<p>Nous mesurons l'audience du site de manière agrégée et anonyme afin d'améliorer nos contenus.</p>
<h2>Vos droits</h2>
<p>Conformément aux bonnes pratiques de protection des données personnelles, vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à topguinee.info@gmail.com.</p>`,
      },
    ],
  })

  // ─── Messages de démo ────────────────────────────────────────
  await db.contactMessage.createMany({
    data: [
      { name: 'Fatoumata Diallo', email: 'fatoumata.d@example.com', subject: 'Partenariat publicitaire', message: 'Bonjour, je souhaite proposer une campagne de publicité pour notre entreprise de téléphonie mobile. Quelles sont vos grilles tarifaires ?', receivedAt: daysAgo(0, 11) },
      { name: 'Ibrahima Sory Bah', email: 'isbah@example.com', subject: 'Correction article', message: 'Bonjour, dans votre article sur les examens nationaux, les dates du BEPC semblent inexactes. Merci de vérifier.', receivedAt: daysAgo(1, 15) },
      { name: 'Awa Keïta', email: 'awa.keita@example.com', subject: 'Proposition de chronique', message: 'Bonjour, je suis juriste et je souhaite proposer une chronique mensuelle sur les questions de droit des femmes.', receivedAt: daysAgo(3, 9), isRead: true },
    ],
  })

  // ─── Journal d'activité ──────────────────────────────────────
  await db.activityLog.createMany({
    data: [
      { userId: admin.id, userLabel: 'Rédaction Topguinee', action: 'PUBLISH', entity: 'Article', detail: 'Publication : Les Syli Nationale qualifiés pour la CAN 2027', createdAt: daysAgo(0, 8, 12) },
      { userId: journalist.id, userLabel: 'Mamadou Camara', action: 'CREATE', entity: 'Article', detail: 'Nouvel article soumis à relecture : Interview exclusive — Ministre du Plan', createdAt: daysAgo(0, 9, 30) },
      { userId: admin.id, userLabel: 'Rédaction Topguinee', action: 'CREATE', entity: 'FlashInfo', detail: 'Flash info urgente ajoutée : plan d\'électrification', createdAt: daysAgo(0, 10, 5) },
      { userId: admin.id, userLabel: 'Rédaction Topguinee', action: 'UPDATE', entity: 'AdCampaign', detail: 'Campagne Orange Money programmée jusqu\'au mois prochain', createdAt: daysAgo(1, 14) },
      { userId: admin.id, userLabel: 'Rédaction Topguinee', action: 'UPDATE', entity: 'Rubrique', detail: 'Réorganisation de l\'ordre des rubriques du menu', createdAt: daysAgo(2, 11) },
    ],
  })

  console.log('✅ Seed terminé :', {
    articles: articles.length,
    rubriques: 10,
    episodes: episodes.length,
    flash: flash.length,
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
