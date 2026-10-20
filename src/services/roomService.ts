import { timetableRequest } from './timetableService'
export interface Room { room_id: number; name: string; kind: 'physical' | 'online'; capacity: number | null; meeting_url: string | null; is_active: boolean; version: number }
export interface RoomInfo { room_id?: number | null; room_kind?: 'physical' | 'online' | null; room_capacity?: number | null; meeting_url?: string | null; room_active?: boolean | null; class_size?: number | null; capacity_warning?: string | null }
export type RoomInput = Omit<Room, 'room_id' | 'version'>
export const listRooms = () => timetableRequest<Room[]>('/rooms')
export const createRoom = (data: RoomInput) => timetableRequest<Room>('/rooms', 'POST', data)
export const updateRoom = (id: number, data: RoomInput & { expected_version: number }) => timetableRequest<Room>('/rooms/' + id, 'PUT', data)
export const getRoomCapacity = (id: number, classId: number, date: string) => timetableRequest<RoomInfo>('/rooms/' + id + '/capacity?' + new URLSearchParams({ class_id: String(classId), on_date: date }))
export const safeMeetingUrl = (value?: string | null) => { try { const url = new URL(value || ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined } }
