// Normalisation de la source audio d'un épisode FM/Podcast.
// Colle ici la logique partagée par POST/PUT /api/admin/episodes —
// hors fichier route.ts car Next n'autorise que les exports HTTP connus.
import { safeMediaUrl } from '@/lib/sanitize'
import { driveFileIdOf, driveFolderIdOf, driveResourceKeyOf, isDriveLink } from './drive-public'

/**
 * • Lien Drive de FICHIER partagé → URL du proxy interne de streaming
 *   (jouable par le lecteur du site, sans clé API Google) ;
 * • lien Drive de DOSSIER → refus guidé vers l'import de dossier ;
 * • toute autre URL valide (Cloudinary, directe…) → conservée telle quelle.
 */
export function normalizeEpisodeAudio(raw: unknown): { url: string } | { error: string } {
  const s = String(raw ?? '').trim()
  if (isDriveLink(s)) {
    const rk = driveResourceKeyOf(s)
    const fileId = driveFileIdOf(s)
    if (fileId) {
      const url = `/api/public/media/audio/${fileId}${rk ? `?rk=${encodeURIComponent(rk)}` : ''}`
      return { url: safeMediaUrl(url) || url }
    }
    if (driveFolderIdOf(s)) {
      return {
        error: 'Lien de DOSSIER Drive détecté. Utilisez le bouton « Importer un dossier Drive » de l\'émission pour en importer tous les audios, ou collez le lien d\'un fichier audio précis.',
      }
    }
    return { error: 'Lien Google Drive non reconnu. Partagez le fichier (« Tout le monde avec le lien ») puis collez le lien du fichier.' }
  }
  const url = safeMediaUrl(s)
  return url ? { url } : { error: 'Source audio invalide.' }
}
