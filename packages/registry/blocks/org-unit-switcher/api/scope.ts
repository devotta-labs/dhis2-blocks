import type { OrgUnit } from './schemas'

/** true when path equals an assigned path or starts with `${assignedPath}/` */
export const isWithinAssigned = (
    path: string,
    assigned: readonly OrgUnit[]
): boolean =>
    assigned.some((a) => path === a.path || path.startsWith(`${a.path}/`))
