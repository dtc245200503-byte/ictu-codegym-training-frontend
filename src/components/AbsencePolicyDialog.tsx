import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { getAbsencePolicy, saveAbsencePolicy, RiskPolicyConflict } from '../services/attendanceRiskService'
import type { AbsencePolicy } from '../services/attendanceRiskService'
import './AttendanceRisk.css'

export default function AbsencePolicyDialog({ courseId, explain, onClose, onSaved }: { courseId: number; explain: (error: unknown) => string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), working = useRef(false)
  const [policy, setPolicy] = useState<AbsencePolicy>(), [value, setValue] = useState('20')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [stale, setStale] = useState(false), [reload, setReload] = useState(0)
  const explainLoad = useEffectEvent(explain)
  useEffect(() => { dialog.current?.showModal(); const node = dialog.current; return () => node?.close() }, [])
  useEffect(() => {
    let active = true
    getAbsencePolicy(courseId).then(data => { if (active) { setPolicy(data); setValue(String(data.threshold_percent)); setError(''); setStale(false) } }).catch(err => { if (active) setError(explainLoad(err)) })
    return () => { active = false }
  }, [courseId, reload])
  const save = async () => {
    if (working.current || !policy?.can_edit || stale) return
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 100) { setError('Nhập ngưỡng từ 0 đến 100%, tối đa hai chữ số thập phân.'); return }
    working.current = true; setBusy(true); setError('')
    try { await saveAbsencePolicy(courseId, Number(value), Number(policy.threshold_percent)); onSaved() }
    catch (err) { setError(explain(err)); if (err instanceof RiskPolicyConflict) setStale(true) }
    finally { working.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="absence-policy-dialog" aria-labelledby="absence-policy-title" onCancel={event => { event.preventDefault(); if (!working.current) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void save() }}><header><h2 id="absence-policy-title">Ngưỡng cảnh báo vắng</h2><button type="button" disabled={busy} onClick={onClose}>Đóng</button></header>
      {policy ? <><h3>{policy.program_name}</h3><label htmlFor="absence-threshold">Ngưỡng vắng (%)</label><input autoFocus id="absence-threshold" type="number" min="0" max="100" step="0.01" required value={value} disabled={busy || stale || !policy.can_edit} onChange={event => setValue(event.target.value)} />
      <p>Mặc định 20%. Bật cờ khi tổng buổi vắng có phép và không phép <strong>vượt</strong> ngưỡng trên tổng buổi đã xếp lịch của lớp, bỏ buổi huỷ. Ví dụ: lớp 10 buổi, ngưỡng 20% sẽ cảnh báo từ buổi vắng thứ 3.</p>
      <p>Áp dụng ngay cho các lớp đang chuẩn bị hoặc đang học của chương trình. Giảng viên và Quản lý đào tạo nhận thông báo khi cờ chuyển từ tắt sang bật.</p>
      {!policy.can_edit && <p>Chỉ Quản lý đào tạo được thay đổi cấu hình.</p>}</> : !error && <p role="status">Đang tải cấu hình…</p>}
      {error && <p role="alert">{error}</p>}
      <footer>{(stale || (!policy && error)) && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Tải lại cấu hình</button>}<button type="button" disabled={busy || !policy?.can_edit || stale} onClick={() => setValue('20')}>Mặc định 20%</button><button type="submit" disabled={busy || !policy?.can_edit || stale}>{busy ? 'Đang lưu…' : 'Lưu ngưỡng'}</button></footer>
    </form>
  </dialog>
}
