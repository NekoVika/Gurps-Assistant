/**
 * Narrow a sidebar section to what is in scope — but only when scope has
 * something to say about that section.
 *
 * Focus narrows who is listed, never what exists. The first version filtered
 * every section against one set of in-scope names, and two sections emptied
 * outright: `/campaign/scope` admits an entity by its shape, so a faction
 * (which has neither `attributes` nor `internalStructure`) could never be a
 * member, and no location carried a story placement yet either. Focusing a
 * scene made every location and faction in the campaign disappear.
 *
 * An empty result means we know nothing about that section, not that nothing
 * in it is relevant. Leaving it whole is the honest answer, and it corrects
 * itself as placement data arrives: the moment one member is in scope, the
 * section narrows normally.
 */
export function narrowToScope<T>(items: T[], isInScope: (item: T) => boolean): T[] {
  const kept = items.filter(isInScope);
  return kept.length > 0 ? kept : items;
}
