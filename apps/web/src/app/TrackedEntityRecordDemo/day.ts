/** The stored `YYYY-MM-DD` part of an API date, shown as it is. */
export const day = (value?: string) => value?.slice(0, 10) ?? ''
