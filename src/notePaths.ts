export const remapPath = (path: string, source: string, destination: string) =>
  path === source || path.startsWith(source + "/")
    ? destination + path.slice(source.length)
    : path;
export function reorderTabs(tabs: string[], source: string, target: string) {
  if (source === target || !tabs.includes(source) || !tabs.includes(target))
    return tabs;
  const next = tabs.filter((path) => path !== source);
  next.splice(tabs.indexOf(target), 0, source);
  return next;
}
