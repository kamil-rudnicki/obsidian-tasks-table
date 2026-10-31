const pad = (value: number): string => String(value).padStart(2, '0')

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const getToday = (): string => toIsoDate(new Date())

export const parseIsoDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const addDays = (isoDate: string, days: number): string => {
  const date = parseIsoDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}
