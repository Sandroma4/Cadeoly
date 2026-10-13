export function profilePhotoUrl(userId: string, filename: string) {
  return `/api/profile-photos/${encodeURIComponent(userId)}/${encodeURIComponent(filename)}`;
}
