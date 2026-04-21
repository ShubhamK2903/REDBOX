export const AVATAR_STYLES = [
  'adventurer',
  'adventurer-neutral',
  'avataaars',
  'bottts-neutral',
  'identicon',
  'micah',
  'open-peeps',
  'personas',
  'thumbs',
  'lorelei',
];

function localKey(userId) {
  return `redbox-avatar-${userId}`;
}

export function saveAvatarPrefs(userId, style, seed) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(localKey(userId), JSON.stringify({ style, seed }));
  } catch {
    // Ignore localStorage write issues.
  }
}

export function getStoredAvatarPrefs(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAvatarSeed(user) {
  if (!user) return 'redbox-user';
  const stored = getStoredAvatarPrefs(user.id);
  return (
    user.avatar_seed ||
    stored?.seed ||
    user.email ||
    `${user.first_name || ''}-${user.last_name || ''}`.trim() ||
    user.id ||
    'redbox-user'
  );
}

export function getAvatarStyle(user) {
  const stored = getStoredAvatarPrefs(user?.id);
  return user?.avatar_style || stored?.style || 'adventurer';
}

export function getAvatarUrl(style, seed) {
  const safeStyle = style || 'adventurer';
  const safeSeed = seed || 'redbox-user';
  return `https://api.dicebear.com/9.x/${safeStyle}/svg?seed=${encodeURIComponent(safeSeed)}`;
}
