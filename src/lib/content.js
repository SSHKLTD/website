// Image-path helpers.
// Committed seed data references /images/works/<slug>/… by convention;
// Notion-synced data carries explicit `cover` / `images` / `logo` paths instead.
export function coverOf(work) {
  return work.cover ?? `/images/works/${work.slug}/cover.webp`;
}

export function galleryOf(work) {
  if (Array.isArray(work.images)) return work.images;
  return Array.from({ length: work.gallery ?? 0 }, (_, i) => `/images/works/${work.slug}/g${i + 1}.webp`);
}

export function logoOf(client) {
  return client.logo ?? `/images/clients/${client.slug}.webp`;
}
