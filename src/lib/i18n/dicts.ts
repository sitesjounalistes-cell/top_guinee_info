// i18n Topguinee.info — dictionnaires de l'interface publique.
// Module de données pures : importable côté client ET serveur.
// La langue du CONTENU éditorial (articles, rubriques, flashs…) est
// traduite côté serveur avec cache (src/lib/server/translate.ts) ;
// ces dictionnaires couvrent les chaînes fixes de l'interface.

export type LangCode = 'fr' | 'en' | 'es' | 'it' | 'ar' | 'zh'

export interface LangMeta {
  code: LangCode
  /** Nom natif affiché dans le sélecteur */
  label: string
  dir: 'ltr' | 'rtl'
}

export const LANGS: LangMeta[] = [
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'zh', label: '中文', dir: 'ltr' },
]

export const LANG_CODES = LANGS.map(l => l.code)
export const DEFAULT_LANG: LangCode = 'fr'

export function isLang(v: string | null | undefined): v is LangCode {
  return !!v && (LANG_CODES as string[]).includes(v)
}

export function langDir(lang: string): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

// ─── Clés de l'interface ─────────────────────────────────────────

export interface Dict {
  // Navigation / header
  searchPlaceholder: string
  home: string
  watchLive: string
  listenFm: string
  // Home
  featured: string
  todaysEssential: string
  seeAll: string
  mostRead: string
  top5: string
  videos: string
  podcasts: string
  latestEpisodes: string
  listenAll: string
  mediaHub: string
  preparing: string
  preparingDesc: string
  carouselPrev: string
  carouselNext: string
  carouselLabel: string
  // Flash info
  flashInfo: string
  // Article
  alsoRead: string
  relatedTopics: string
  allRubric: string
  minutesRead: string
  views: string
  translationNotice: string
  // Recherche / listes
  search: string
  resultsFor: string
  noResults: string
  noResultsDesc: string
  loadMore: string
  page: string
  // Erreurs / états
  errorTitle: string
  errorDesc: string
  retry: string
  notFoundTitle: string
  notFoundDesc: string
  backHome: string
  unavailable: string
  // Contact
  contact: string
  contactName: string
  contactEmail: string
  contactSubject: string
  contactMessage: string
  contactSend: string
  contactSent: string
  // Footer
  rubrics: string
  theMedia: string
  about: string
  legal: string
  privacy: string
  contactUs: string
  adminArea: string
  rights: string
  proudly: string
  // Divers
  advertisement: string
  backToTop: string
  language: string
  latestNews: string
  allArticles: string
  sortBy: string
  sortRecent: string
  sortOldest: string
  sortViews: string
  hasVideo: string
  radioPlayer: string
  listens: string
  liveAndVideos: string
  emptySection: string
}

const fr: Dict = {
  searchPlaceholder: 'Rechercher sur le site…',
  home: 'Accueil',
  watchLive: 'Voir le direct',
  listenFm: 'Écouter',
  featured: 'À la une',
  todaysEssential: "L'essentiel du jour",
  seeAll: 'Tout voir',
  mostRead: 'Les plus lus',
  top5: 'Top 5',
  videos: 'Vidéos',
  podcasts: 'Podcasts',
  latestEpisodes: 'Derniers épisodes',
  listenAll: 'Tout écouter',
  mediaHub: 'Médias — vidéos et podcasts',
  preparing: 'La Une se prépare',
  preparingDesc: 'Nos journalistes sélectionnent les informations du moment. Revenez dans quelques instants !',
  carouselPrev: 'Article précédent',
  carouselNext: 'Article suivant',
  carouselLabel: 'Articles à la une',
  flashInfo: 'Flash Info',
  alsoRead: 'À lire aussi',
  relatedTopics: 'Sujets liés',
  allRubric: 'Toute la rubrique',
  minutesRead: 'min de lecture',
  views: 'vues',
  translationNotice: 'Traduction automatique',
  search: 'Recherche',
  resultsFor: 'Résultats pour',
  noResults: 'Aucun résultat',
  noResultsDesc: 'Essayez d’autres mots-clés ou parcourez nos rubriques.',
  loadMore: ' Charger plus',
  page: 'Page',
  errorTitle: 'Une erreur est survenue',
  errorDesc: 'Impossible de charger ce contenu. Vérifiez votre connexion puis réessayez.',
  retry: 'Réessayer',
  notFoundTitle: 'Page introuvable',
  notFoundDesc: 'Cette page n’existe pas ou a été déplacée.',
  backHome: "Retour à l'accueil",
  unavailable: 'Indisponible pour le moment',
  contact: 'Contact',
  contactName: 'Votre nom',
  contactEmail: 'Votre e-mail',
  contactSubject: 'Sujet',
  contactMessage: 'Votre message',
  contactSend: 'Envoyer le message',
  contactSent: 'Message envoyé',
  rubrics: 'Rubriques',
  theMedia: 'Le média',
  about: 'À propos de nous',
  legal: 'Mentions légales',
  privacy: 'Confidentialité',
  contactUs: 'Nous contacter',
  adminArea: 'Espace admin',
  rights: 'Tous droits réservés',
  proudly: 'Fièrement conçu en Guinée',
  advertisement: 'Publicité',
  backToTop: 'Retour en haut de page',
  language: 'Langue',
  latestNews: 'Dernières actualités',
  allArticles: 'Tous les articles',
  sortBy: 'Trier par',
  sortRecent: 'Plus récents',
  sortOldest: 'Plus anciens',
  sortViews: 'Plus lus',
  hasVideo: 'Vidéos',
  radioPlayer: 'Lecteur',
  listens: 'écoutes',
  liveAndVideos: 'Direct & vidéos',
  emptySection: 'Aucun contenu disponible pour le moment',
}

const en: Dict = {
  searchPlaceholder: 'Search the site…',
  home: 'Home',
  watchLive: 'Watch live',
  listenFm: 'Listen',
  featured: 'Top stories',
  todaysEssential: "Today's essential news",
  seeAll: 'See all',
  mostRead: 'Most read',
  top5: 'Top 5',
  videos: 'Videos',
  podcasts: 'Podcasts',
  latestEpisodes: 'Latest episodes',
  listenAll: 'Listen to all',
  mediaHub: 'Media — videos and podcasts',
  preparing: 'Our front page is being prepared',
  preparingDesc: 'Our journalists are selecting the latest news. Check back shortly!',
  carouselPrev: 'Previous article',
  carouselNext: 'Next article',
  carouselLabel: 'Featured articles',
  flashInfo: 'Breaking news',
  alsoRead: 'Also read',
  relatedTopics: 'Related topics',
  allRubric: 'Whole section',
  minutesRead: 'min read',
  views: 'views',
  translationNotice: 'Automatic translation',
  search: 'Search',
  resultsFor: 'Results for',
  noResults: 'No results',
  noResultsDesc: 'Try other keywords or browse our sections.',
  loadMore: 'Load more',
  page: 'Page',
  errorTitle: 'Something went wrong',
  errorDesc: 'This content could not be loaded. Check your connection and try again.',
  retry: 'Try again',
  notFoundTitle: 'Page not found',
  notFoundDesc: 'This page does not exist or has been moved.',
  backHome: 'Back to home',
  unavailable: 'Currently unavailable',
  contact: 'Contact',
  contactName: 'Your name',
  contactEmail: 'Your email',
  contactSubject: 'Subject',
  contactMessage: 'Your message',
  contactSend: 'Send message',
  contactSent: 'Message sent',
  rubrics: 'Sections',
  theMedia: 'The media',
  about: 'About us',
  legal: 'Legal notice',
  privacy: 'Privacy',
  contactUs: 'Contact us',
  adminArea: 'Admin area',
  rights: 'All rights reserved',
  proudly: 'Proudly made in Guinea',
  advertisement: 'Advertisement',
  backToTop: 'Back to top',
  language: 'Language',
  latestNews: 'Latest news',
  allArticles: 'All articles',
  sortBy: 'Sort by',
  sortRecent: 'Newest first',
  sortOldest: 'Oldest first',
  sortViews: 'Most read',
  hasVideo: 'Videos',
  radioPlayer: 'Player',
  listens: 'plays',
  liveAndVideos: 'Live & videos',
  emptySection: 'No content available at the moment',
}

const es: Dict = {
  searchPlaceholder: 'Buscar en el sitio…',
  home: 'Inicio',
  watchLive: 'Ver en directo',
  listenFm: 'Escuchar',
  featured: 'Portada',
  todaysEssential: 'Lo esencial del día',
  seeAll: 'Ver todo',
  mostRead: 'Lo más leído',
  top5: 'Top 5',
  videos: 'Vídeos',
  podcasts: 'Pódcasts',
  latestEpisodes: 'Últimos episodios',
  listenAll: 'Escuchar todo',
  mediaHub: 'Medios — vídeos y pódcasts',
  preparing: 'Estamos preparando la portada',
  preparingDesc: 'Nuestros periodistas seleccionan la actualidad del momento. ¡Vuelva en unos instantes!',
  carouselPrev: 'Artículo anterior',
  carouselNext: 'Artículo siguiente',
  carouselLabel: 'Artículos destacados',
  flashInfo: 'Última hora',
  alsoRead: 'Lea también',
  relatedTopics: 'Temas relacionados',
  allRubric: 'Toda la sección',
  minutesRead: 'min de lectura',
  views: 'lecturas',
  translationNotice: 'Traducción automática',
  search: 'Búsqueda',
  resultsFor: 'Resultados para',
  noResults: 'Sin resultados',
  noResultsDesc: 'Pruebe con otras palabras o explore nuestras secciones.',
  loadMore: 'Cargar más',
  page: 'Página',
  errorTitle: 'Se ha producido un error',
  errorDesc: 'No se pudo cargar este contenido. Compruebe su conexión e inténtelo de nuevo.',
  retry: 'Reintentar',
  notFoundTitle: 'Página no encontrada',
  notFoundDesc: 'Esta página no existe o ha sido movida.',
  backHome: 'Volver al inicio',
  unavailable: 'No disponible por el momento',
  contact: 'Contacto',
  contactName: 'Su nombre',
  contactEmail: 'Su correo electrónico',
  contactSubject: 'Asunto',
  contactMessage: 'Su mensaje',
  contactSend: 'Enviar mensaje',
  contactSent: 'Mensaje enviado',
  rubrics: 'Secciones',
  theMedia: 'El medio',
  about: 'Sobre nosotros',
  legal: 'Aviso legal',
  privacy: 'Privacidad',
  contactUs: 'Contáctenos',
  adminArea: 'Área de administración',
  rights: 'Todos los derechos reservados',
  proudly: 'Hecho con orgullo en Guinea',
  advertisement: 'Publicidad',
  backToTop: 'Volver arriba',
  language: 'Idioma',
  latestNews: 'Últimas noticias',
  allArticles: 'Todos los artículos',
  sortBy: 'Ordenar por',
  sortRecent: 'Más recientes',
  sortOldest: 'Más antiguos',
  sortViews: 'Más leídos',
  hasVideo: 'Vídeos',
  radioPlayer: 'Reproductor',
  listens: 'reproducciones',
  liveAndVideos: 'En directo y vídeos',
  emptySection: 'No hay contenido disponible por el momento',
}

const it: Dict = {
  searchPlaceholder: 'Cerca nel sito…',
  home: 'Home',
  watchLive: 'Guarda in diretta',
  listenFm: 'Ascolta',
  featured: 'Prima pagina',
  todaysEssential: "L'essenziale del giorno",
  seeAll: 'Vedi tutto',
  mostRead: 'I più letti',
  top5: 'Top 5',
  videos: 'Video',
  podcasts: 'Podcast',
  latestEpisodes: 'Ultimi episodi',
  listenAll: 'Ascolta tutto',
  mediaHub: 'Media — video e podcast',
  preparing: 'Stiamo preparando la prima pagina',
  preparingDesc: 'I nostri giornalisti selezionano le notizie del momento. Torna tra poco!',
  carouselPrev: 'Articolo precedente',
  carouselNext: 'Articolo successivo',
  carouselLabel: 'Articoli in evidenza',
  flashInfo: 'Ultime notizie',
  alsoRead: 'Leggi anche',
  relatedTopics: 'Argomenti correlati',
  allRubric: 'Tutta la rubrica',
  minutesRead: 'min di lettura',
  views: 'letture',
  translationNotice: 'Traduzione automatica',
  search: 'Ricerca',
  resultsFor: 'Risultati per',
  noResults: 'Nessun risultato',
  noResultsDesc: 'Prova con altre parole o sfoglia le nostre rubriche.',
  loadMore: 'Carica altro',
  page: 'Pagina',
  errorTitle: 'Si è verificato un errore',
  errorDesc: 'Impossibile caricare questo contenuto. Controlla la connessione e riprova.',
  retry: 'Riprova',
  notFoundTitle: 'Pagina non trovata',
  notFoundDesc: 'Questa pagina non esiste o è stata spostata.',
  backHome: "Torna all'inizio",
  unavailable: 'Non disponibile al momento',
  contact: 'Contatti',
  contactName: 'Il tuo nome',
  contactEmail: 'La tua e-mail',
  contactSubject: 'Oggetto',
  contactMessage: 'Il tuo messaggio',
  contactSend: 'Invia messaggio',
  contactSent: 'Messaggio inviato',
  rubrics: 'Rubriche',
  theMedia: 'Il medium',
  about: 'Chi siamo',
  legal: 'Note legali',
  privacy: 'Privacy',
  contactUs: 'Contattaci',
  adminArea: 'Area admin',
  rights: 'Tutti i diritti riservati',
  proudly: 'Fieramente realizzato in Guinea',
  advertisement: 'Pubblicità',
  backToTop: 'Torna in alto',
  language: 'Lingua',
  latestNews: 'Ultime notizie',
  allArticles: 'Tutti gli articoli',
  sortBy: 'Ordina per',
  sortRecent: 'Più recenti',
  sortOldest: 'Più antichi',
  sortViews: 'Più letti',
  hasVideo: 'Video',
  radioPlayer: 'Lettore',
  listens: 'ascolti',
  liveAndVideos: 'In diretta e video',
  emptySection: 'Nessun contenuto disponibile al momento',
}

const ar: Dict = {
  searchPlaceholder: 'ابحث في الموقع…',
  home: 'الرئيسية',
  watchLive: 'شاهد البث المباشر',
  listenFm: 'استمع',
  featured: 'الرئيسية',
  todaysEssential: 'أهم أخبار اليوم',
  seeAll: 'عرض الكل',
  mostRead: 'الأكثر قراءة',
  top5: 'أفضل 5',
  videos: 'فيديوهات',
  podcasts: 'بودكاست',
  latestEpisodes: 'أحدث الحلقات',
  listenAll: 'استمع إلى الكل',
  mediaHub: 'الوسائط — فيديوهات وبودكاست',
  preparing: 'نحن نجهز الصفحة الرئيسية',
  preparingDesc: 'صحفيونا يختارون أخبار اللحظة. عودوا بعد قليل!',
  carouselPrev: 'المقال السابق',
  carouselNext: 'المقال التالي',
  carouselLabel: 'المقالات الرئيسية',
  flashInfo: 'آخر الأخبار العاجلة',
  alsoRead: 'اقرأ أيضاً',
  relatedTopics: 'مواضيع ذات صلة',
  allRubric: 'كل القسم',
  minutesRead: 'دقيقة قراءة',
  views: 'مشاهدة',
  translationNotice: 'ترجمة آلية',
  search: 'بحث',
  resultsFor: 'نتائج البحث عن',
  noResults: 'لا توجد نتائج',
  noResultsDesc: 'جرّب كلمات أخرى أو تصفّح أقسامنا.',
  loadMore: 'تحميل المزيد',
  page: 'صفحة',
  errorTitle: 'حدث خطأ',
  errorDesc: 'تعذّر تحميل هذا المحتوى. تحقق من اتصالك ثم أعد المحاولة.',
  retry: 'إعادة المحاولة',
  notFoundTitle: 'الصفحة غير موجودة',
  notFoundDesc: 'هذه الصفحة غير موجودة أو تم نقلها.',
  backHome: 'العودة إلى الرئيسية',
  unavailable: 'غير متوفر حالياً',
  contact: 'اتصل بنا',
  contactName: 'اسمك',
  contactEmail: 'بريدك الإلكتروني',
  contactSubject: 'الموضوع',
  contactMessage: 'رسالتك',
  contactSend: 'إرسال الرسالة',
  contactSent: 'تم إرسال الرسالة',
  rubrics: 'الأقسام',
  theMedia: 'المؤسسة الإعلامية',
  about: 'من نحن',
  legal: 'المعلومات القانونية',
  privacy: 'الخصوصية',
  contactUs: 'اتصل بنا',
  adminArea: 'فضاء الإدارة',
  rights: 'جميع الحقوق محفوظة',
  proudly: 'صُنع بفخر في غينيا',
  advertisement: 'إعلان',
  backToTop: 'العودة إلى الأعلى',
  language: 'اللغة',
  latestNews: 'آخر الأخبار',
  allArticles: 'جميع المقالات',
  sortBy: 'ترتيب حسب',
  sortRecent: 'الأحدث',
  sortOldest: 'الأقدم',
  sortViews: 'الأكثر قراءة',
  hasVideo: 'فيديوهات',
  radioPlayer: 'المشغّل',
  listens: 'استماعاً',
  liveAndVideos: 'البث المباشر والفيديوهات',
  emptySection: 'لا يوجد محتوى متاح حالياً',
}

const zh: Dict = {
  searchPlaceholder: '搜索网站…',
  home: '首页',
  watchLive: '观看直播',
  listenFm: '收听',
  featured: '头条新闻',
  todaysEssential: '今日要闻',
  seeAll: '查看全部',
  mostRead: '最多阅读',
  top5: '前 5 名',
  videos: '视频',
  podcasts: '播客',
  latestEpisodes: '最新剧集',
  listenAll: '收听全部',
  mediaHub: '媒体 — 视频与播客',
  preparing: '头版正在筹备中',
  preparingDesc: '我们的记者正在精选时事新闻，请稍后再来！',
  carouselPrev: '上一篇',
  carouselNext: '下一篇',
  carouselLabel: '头条文章',
  flashInfo: '快讯',
  alsoRead: '延伸阅读',
  relatedTopics: '相关话题',
  allRubric: '整个栏目',
  minutesRead: '分钟阅读',
  views: '次浏览',
  translationNotice: '自动翻译',
  search: '搜索',
  resultsFor: '搜索结果',
  noResults: '没有结果',
  noResultsDesc: '请尝试其他关键词或浏览我们的栏目。',
  loadMore: '加载更多',
  page: '第',
  errorTitle: '出现错误',
  errorDesc: '无法加载此内容。请检查网络后重试。',
  retry: '重试',
  notFoundTitle: '页面未找到',
  notFoundDesc: '该页面不存在或已被移动。',
  backHome: '返回首页',
  unavailable: '暂不可用',
  contact: '联系我们',
  contactName: '您的姓名',
  contactEmail: '您的电子邮箱',
  contactSubject: '主题',
  contactMessage: '您的留言',
  contactSend: '发送留言',
  contactSent: '留言已发送',
  rubrics: '栏目',
  theMedia: '媒体',
  about: '关于我们',
  legal: '法律声明',
  privacy: '隐私政策',
  contactUs: '联系我们',
  adminArea: '管理后台',
  rights: '版权所有',
  proudly: '自豪地创作于几内亚',
  advertisement: '广告',
  backToTop: '回到顶部',
  language: '语言',
  latestNews: '最新新闻',
  allArticles: '全部文章',
  sortBy: '排序方式',
  sortRecent: '最新优先',
  sortOldest: '最早优先',
  sortViews: '阅读最多',
  hasVideo: '视频',
  radioPlayer: '播放器',
  listens: '次收听',
  liveAndVideos: '直播与视频',
  emptySection: '暂无可用内容',
}

export const DICTS: Record<LangCode, Dict> = { fr, en, es, it, ar, zh }

/** Dictionnaire pour une langue (repli sur le français). */
export function getDict(lang: string | null | undefined): Dict {
  return (isLang(lang) && lang !== 'fr' ? DICTS[lang] : fr) as Dict
}
