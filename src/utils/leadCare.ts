export const careTypes = { call: 'Gọi điện', message: 'Nhắn tin', meeting: 'Gặp trực tiếp' }
export const careDate = (value: string) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
// datetime-local has no timezone: explicitly interpret every input in Vietnam.
export const careInput = (value = new Date().toISOString()) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16)
export const careISO = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00+07:00`)
  return Number.isFinite(date.getTime()) && careInput(date.toISOString()) === value ? date.toISOString() : null
}
export const callbackOverdue = (value: string | null | undefined, now = Date.now()) => !!value && new Date(value).getTime() < now
