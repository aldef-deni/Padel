/** Public avatar URL; the file name changes on every upload, so it doubles as a cache buster. */
export function userAvatarUrl(user: {
  id: string;
  avatarFile: string | null;
}): string | null {
  return user.avatarFile
    ? `/api/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarFile)}`
    : null;
}
