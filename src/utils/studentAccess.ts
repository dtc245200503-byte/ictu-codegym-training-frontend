import type { CurrentUser } from '../types/auth'
export const canManageStudentProfiles = (user: CurrentUser) => user.permissions.includes('STUDENT_MANAGE') && user.roles.some(role => ['TRAINING_MANAGER', 'MANAGER'].includes(role))
