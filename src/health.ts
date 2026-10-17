/** Tello is not for health care (no PHI, no BAA). Two or more clear health-care words in the business name or website stops setup. */
const HEALTH_WORDS = /\b(patients?|clinic|clinics|medical|physicians?|dentists?|dental|pharmacy|hospital|therap(?:y|ist|ists)|mental health|nursing|home health|health ?care|medications?|urgent care|chiropract\w*|dermatolog\w*|pediatric\w*|surgeon|surgery|hipaa)\b/gi;
export function looksLikeHealthCare(...texts: string[]): boolean {
  const hits = new Set((texts.join(" ").match(HEALTH_WORDS) || []).map((w) => w.toLowerCase()));
  return hits.size >= 2;
}
export const HEALTH_MSG = "The Tello website chat is not available for health care or medical businesses. If you run a California care home, see Title22 at title-22.com. If this is a mistake, email support@tello.live.";
