const pad = (value: number) => value.toString().padStart(2, '0')

/** The viewer's local day of `date` as `YYYY-MM-DD`. */
export const localDay = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
