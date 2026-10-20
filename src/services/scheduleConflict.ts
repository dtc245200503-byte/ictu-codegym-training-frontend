export interface ConflictSession {
  session_id: number | null; number?: number | null; class_name: string; subject_name: string; topic: string
  session_date: string; start_time: string; end_time: string | null; room_name: string | null
  staff: { user_id: number; name: string }[]
}
export interface ScheduleConflict {
  candidate: ConflictSession; existing: ConflictSession; reasons: string[]
  instructors: { user_id: number; name: string }[]; unknown_duration: boolean
}
export interface ConflictDetails {
  code: 'schedule_conflict'; message: string; conflicts: ScheduleConflict[]; can_override: boolean; conflict_token: string | null
}
export interface ConflictConfirmation { acknowledge_conflicts?: boolean; conflict_token?: string }
export class ScheduleConflictError extends Error {
  details: ConflictDetails
  constructor(details: ConflictDetails) { super(details.message); this.details = details }
}
export function throwScheduleConflict(detail: unknown) {
  if (detail && typeof detail === 'object' && 'code' in detail && detail.code === 'schedule_conflict' && 'conflicts' in detail && Array.isArray(detail.conflicts)) {
    throw new ScheduleConflictError(detail as ConflictDetails)
  }
}
