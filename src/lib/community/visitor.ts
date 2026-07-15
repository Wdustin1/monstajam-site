export const COMMUNITY_VISITOR_ID_KEY = 'monstajam-visitor-id';

export function getOrCreateCommunityVisitorId() {
  const existing = localStorage.getItem(COMMUNITY_VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const visitorId = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(COMMUNITY_VISITOR_ID_KEY, visitorId);
  return visitorId;
}
