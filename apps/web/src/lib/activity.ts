export type ActivityItem = {
  key: string;
  title: string;
  href: string;
  date: string;
  unseen: boolean;
};
export type ActivitySection = {
  total: number;
  unseen: number;
  keys: string[];
  unseenKeys: string[];
  latest: ActivityItem[];
};
export type ActivityState = { serverTime: string; sections: Record<string, ActivitySection> };
export function uniqueUnseenCount(value: ActivityState | null, paths: string[]) {
  return new Set(paths.flatMap((path) => value?.sections[path]?.unseenKeys || [])).size;
}
export function acknowledgeActivity(
  value: ActivityState | null,
  keys: string[],
): ActivityState | null {
  if (!value) return null;
  const read = new Set(keys);
  return {
    ...value,
    sections: Object.fromEntries(
      Object.entries(value.sections).map(([path, section]) => {
        const unseenKeys = section.unseenKeys.filter((k) => !read.has(k));
        return [
          path,
          {
            ...section,
            unseenKeys,
            unseen: unseenKeys.length,
            latest: section.latest.map((i) => (read.has(i.key) ? { ...i, unseen: false } : i)),
          },
        ];
      }),
    ),
  };
}
