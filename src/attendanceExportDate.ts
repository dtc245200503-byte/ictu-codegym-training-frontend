export function hoChiMinhDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value)
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((item) => item.type === type)?.value
  const year = part('year')
  const month = part('month')
  const day = part('day')
  if (!year || !month || !day) throw new Error('Không thể xác định ngày xuất tại Việt Nam.')
  return `${year}-${month}-${day}`
}

export function formatHoChiMinhDateTime(value: string): string {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  const instant = new Date(hasTimezone ? value : `${value}+07:00`)
  if (Number.isNaN(instant.getTime())) return value

  const parts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(instant)
  const part = (type: 'year' | 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((item) => item.type === type)?.value
  const year = part('year')
  const month = part('month')
  const day = part('day')
  const hour = part('hour')
  const minute = part('minute')
  if (!year || !month || !day || !hour || !minute) return value
  return `${day}/${month}/${year} ${hour}:${minute}`
}
