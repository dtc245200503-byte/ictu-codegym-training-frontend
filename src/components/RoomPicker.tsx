import { useEffect, useEffectEvent, useState } from 'react'
import { getRoomCapacity, safeMeetingUrl, type Room, type RoomInfo } from '../services/roomService'
import './RoomsPage.css'
export default function RoomPicker({ rooms, value, onChange, classId, date, disabled, label = 'Phòng học', legacyName, retainedId, explain, getCapacity = getRoomCapacity }: {
  rooms: Room[]; value: string; onChange: (value: string) => void; classId?: number; date: string; disabled?: boolean; label?: string
  legacyName?: string | null; retainedId?: number | null; explain: (error: unknown) => string
  getCapacity?: typeof getRoomCapacity
}) {
  const [result, setResult] = useState<{ key: string; data?: RoomInfo; error?: string }>()
  const key = [value, classId, date].join(':')
  const room = rooms.find(item => String(item.room_id) === value)
  const needsCheck = !!value && value !== 'legacy' && !!classId && !!date
  const explainError = useEffectEvent(explain)
  useEffect(() => {
    if (!needsCheck) return
    let active = true
    getCapacity(Number(value), classId!, date).then(data => { if (active) setResult({ key, data }) })
      .catch(error => { if (active) setResult({ key, error: explainError(error) }) })
    return () => { active = false }
  }, [value, classId, date, key, needsCheck, getCapacity])
  const current = result?.key === key ? result : undefined
  const link = safeMeetingUrl(room?.meeting_url)
  return <div className="room-picker"><label>{label}<select aria-label={label} disabled={disabled} value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Chưa xếp phòng</option>
    {rooms.filter(item => item.is_active || item.room_id === retainedId).map(item => <option key={item.room_id} value={item.room_id}>{item.name} · {item.kind === 'online' ? 'Trực tuyến' : item.capacity + ' chỗ'}{!item.is_active && ' · Ngừng sử dụng'}</option>)}
    {legacyName && !retainedId && <option value="legacy">{legacyName} · Tên phòng cũ</option>}
    {retainedId && !rooms.some(item => item.room_id === retainedId) && <option value={retainedId}>{legacyName || 'Phòng hiện tại'} · Phân công hiện tại</option>}
  </select></label>
  {value === 'legacy' && <p>Phòng cũ chưa liên kết danh mục. Chọn phòng đã khai báo để kiểm tra sức chứa.</p>}
  {link && <a href={link} target="_blank" rel="noopener noreferrer">Mở phòng trực tuyến ↗</a>}
  {needsCheck && !current && <p role="status">Đang kiểm tra sức chứa…</p>}
  {needsCheck && current?.error && <p className="room-warning" role="alert">Chưa kiểm tra được sức chứa: {current.error}</p>}
  {needsCheck && current?.data && <div aria-live="polite">{current.data.capacity_warning ? <p className="room-warning" role="alert">⚠ {current.data.capacity_warning}</p> : <p>{current.data.class_size} học viên{current.data.room_kind === 'physical' ? ' / ' + current.data.room_capacity + ' chỗ' : ' · Phòng trực tuyến'}</p>}{current.data.room_active === false && <p className="room-warning">Phòng đã ngừng sử dụng.</p>}</div>}
  </div>
}
