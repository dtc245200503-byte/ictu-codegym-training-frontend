export function auditDateRange(from: string, to: string): {
  fromDate: string | null
  toDate: string | null
} {
  return {
    fromDate: from ? `${from}T00:00:00+07:00` : null,
    toDate: to ? `${to}T23:59:59.999999+07:00` : null,
  }
}
