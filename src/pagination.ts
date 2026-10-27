export type PaginationMetadata = {
  page: number
  pageSize: number
  total: number
  pages: number
  hasPrevious: boolean
  hasNext: boolean
}

export function paginationFromHeaders(
  headers: Headers,
  fallback: { page: number; pageSize: number; total?: number },
): PaginationMetadata {
  const page = Number(headers.get('X-Current-Page')) || fallback.page
  const pageSize = Number(headers.get('X-Page-Size')) || fallback.pageSize
  const totalHeader = headers.get('X-Total-Count')
  const total = totalHeader === null ? Number.NaN : Number(totalHeader)
  const resolvedTotal = Number.isFinite(total) && total >= 0 ? total : fallback.total ?? 0
  const calculatedPages = Math.ceil(resolvedTotal / pageSize)
  return {
    page,
    pageSize,
    total: resolvedTotal,
    pages: Number(headers.get('X-Total-Pages')) || calculatedPages,
    hasPrevious: headers.get('X-Has-Previous') === 'true' || page > 1,
    hasNext: headers.get('X-Has-Next') === 'true' || page < calculatedPages,
  }
}
