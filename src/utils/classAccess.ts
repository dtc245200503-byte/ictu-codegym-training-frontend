import type { CurrentUser } from '../types/auth'

const teachingRoles = ['INSTRUCTOR', 'TEACHER', 'ASSISTANT', 'TA']
const managerRoles = ['ADMIN', 'TRAINING_MANAGER', 'MANAGER', 'ACADEMIC_AFFAIRS']

export const canViewClasses = (user: CurrentUser) => user.permissions.includes('CLASS_MANAGE') || user.roles.some(role => teachingRoles.includes(role))
export const canAssignTeachers = (user: CurrentUser) => user.permissions.includes('CLASS_MANAGE') && user.roles.some(role => managerRoles.includes(role))
