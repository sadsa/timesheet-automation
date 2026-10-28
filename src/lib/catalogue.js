/**
 * The Portal Catalogue: the Project/Category pairings the Entelect portal currently
 * accepts. config/projects-categories.json is a copy of it, refreshed by
 * `npm run sync-projects`; submission also reads it live before submitting anything.
 *
 * Shape everywhere: { "Project": ["Category", ...] }.
 */

/**
 * Label of the portal's overflow dropdown button. It looks like a Category (and is
 * the text of a `.timesheetlistitem`) but selects nothing — clicking it only opens
 * the dropdown. Never a valid Category name.
 */
export const OVERFLOW_LABEL = 'Other';

/**
 * Builds a catalogue from the portal view model's projects. Knockout pads both lists
 * with an `Id: -1` placeholder that renders as the overflow dropdown; drop those.
 */
export function toCatalogue(projects) {
  const catalogue = {};
  for (const project of projects) {
    if (project.Id === -1 || !project.Name) continue;
    catalogue[project.Name] = (project.Categories ?? [])
      .filter(c => c.Id !== -1 && c.Name && c.Name !== OVERFLOW_LABEL)
      .map(c => c.Name);
  }
  return catalogue;
}

export function hasPairing(catalogue, project, category) {
  return catalogue[project]?.includes(category) ?? false;
}

/** Indexes of unsubmitted Entries whose pairing the catalogue does not accept. */
export function entriesOutsideCatalogue(entries, catalogue) {
  return entries
    .map((entry, i) => i)
    .filter(i => !entries[i].submitted && !hasPairing(catalogue, entries[i].project, entries[i].category));
}

/** Pairings added and removed going from `before` to `after`, as "Project / Category". */
export function diffCatalogues(before, after) {
  const pairings = catalogue =>
    new Set(Object.entries(catalogue).flatMap(([p, cs]) => cs.map(c => `${p} / ${c}`)));
  const a = pairings(before);
  const b = pairings(after);
  return {
    added: [...b].filter(x => !a.has(x)),
    removed: [...a].filter(x => !b.has(x))
  };
}

/** Repos in config/repo-categories.json mapped to a pairing the catalogue lacks. */
export function staleRepoMappings(repoCategories, catalogue) {
  return Object.entries(repoCategories)
    .filter(([, { project, category }]) => !hasPairing(catalogue, project, category))
    .map(([repo, { project, category }]) => `${repo} → ${project} / ${category}`);
}
