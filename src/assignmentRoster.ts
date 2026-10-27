export type AssignmentRosterRecord = {
  student_id: number
  student_code: string | null
  full_name: string
  status: 'submitted' | 'not_submitted' | 'not_graded' | 'graded' | 'late'
}

export type AssignmentRosterFilter = 'all' | 'submitted' | 'not_submitted' | 'not_graded' | 'graded' | 'late'

export function filterAssignmentRoster<T extends AssignmentRosterRecord>(
  entries: T[],
  search: string,
  status: AssignmentRosterFilter,
): T[] {
  const term = search.trim().toLocaleLowerCase()
  return entries.filter((entry) => {
    if (status !== 'all' && entry.status !== status) return false
    if (!term) return true
    return `${entry.student_code ?? ''} ${entry.student_id} ${entry.full_name}`
      .toLocaleLowerCase()
      .includes(term)
  })
}

export function summarizeAssignmentRoster(entries: AssignmentRosterRecord[]) {
  const submitted = entries.filter((entry) => entry.status !== 'not_submitted').length
  const total = entries.length
  return { submitted, notSubmitted: total - submitted, total, ratio: total ? submitted / total : 0 }
}
