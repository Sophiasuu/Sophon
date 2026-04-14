export function buildSvelteKitPageModule(): string {
  return `export const prerender = true;

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
  ogImage: __ENTITY_OG_IMAGE__,
} as const;

export function load() {
  return {
    entity,
  };
}
`;
}