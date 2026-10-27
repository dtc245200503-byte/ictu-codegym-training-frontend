import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { ListPagination } from '../components/ListControls'
import { showError } from '../format'

type Classroom = { id: number; code: string; capacity: number; online_url: string | null }

function ClassroomEditor({
  room,
  onClose,
  onSaved,
}: {
  room: Classroom | null
  onClose: () => void
  onSaved: () => void
}) {
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    try {
      await apiRequest(room ? `/rooms/${room.id}` : '/rooms', {
        method: room ? 'PATCH' : 'POST',
        body: JSON.stringify({
          code: fields.get('code'),
          capacity: Number(fields.get('capacity')),
          online_url: fields.get('online_url') || null,
        }),
      })
      onSaved()
    } catch (error) {
      setProblem(showError(error))
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="DANH MỤC ĐÀO TẠO" onClose={onClose} title={room ? 'Cập nhật phòng học' : 'Thêm phòng học'}>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field"><span>Mã phòng <b>*</b></span><input autoFocus defaultValue={room?.code} maxLength={80} name="code" required /></label>
        <label className="field"><span>Sức chứa <b>*</b></span><input defaultValue={room?.capacity ?? 40} max={1000} min={1} name="capacity" required type="number" /></label>
        <label className="field"><span>Link học trực tuyến</span><input defaultValue={room?.online_url ?? ''} maxLength={500} name="online_url" placeholder="https://..." type="url" /></label>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu phòng học'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Classroom[]>([])
  const [editor, setEditor] = useState<Classroom | null | undefined>(undefined)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    apiRequest<Classroom[]>('/rooms')
      .then((result) => { setRooms(result); setProblem('') })
      .catch((error: unknown) => setProblem(showError(error)))
  }, [refresh])

  async function remove(room: Classroom) {
    if (!window.confirm(`Xóa phòng ${room.code}?`)) return
    try {
      await apiRequest(`/rooms/${room.id}`, { method: 'DELETE' })
      setRefresh((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    }
  }

  const filteredRooms = rooms.filter((room) =>
    `${room.code} ${room.online_url ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  )
  const pageCount = Math.max(1, Math.ceil(filteredRooms.length / pageSize))
  const visibleRooms = filteredRooms.slice((page - 1) * pageSize, page * pageSize)

  return (
    <section className="page-section">
      <div className="page-title-row">
        <div><span className="eyebrow">DANH MỤC ĐÀO TẠO</span><h1>Phòng học</h1><p>Quản lý mã phòng, sức chứa và liên kết lớp học trực tuyến.</p></div>
        <button className="button button-primary" onClick={() => setEditor(null)} type="button"><UiIcon name="plus" size={17} /> Thêm phòng</button>
      </div>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="list-toolbar panel">
        <label className="search-box list-search">
          <UiIcon name="search" size={18} />
          <input aria-label="Tìm phòng học" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo mã phòng hoặc liên kết…" type="search" value={search} />
        </label>
        <span className="table-total">{filteredRooms.length} phòng</span>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>MÃ PHÒNG</th><th>SỨC CHỨA</th><th>LINK TRỰC TUYẾN</th><th /></tr></thead>
          <tbody>
            {!visibleRooms.length ? <tr><td className="table-empty" colSpan={4}>Không tìm thấy phòng phù hợp.</td></tr> : null}
            {visibleRooms.map((room) => (
              <tr key={room.id}>
                <td><strong>{room.code}</strong></td>
                <td>{room.capacity} chỗ</td>
                <td>{room.online_url ? <a href={room.online_url} rel="noreferrer" target="_blank">Mở liên kết</a> : '—'}</td>
                <td><div className="row-actions"><button className="button button-outline button-small" onClick={() => setEditor(room)} type="button">Sửa</button><button className="button button-outline button-small" onClick={() => void remove(room)} type="button">Xóa</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRooms.length > pageSize ? <ListPagination page={page} pageSize={pageSize} total={filteredRooms.length} onPageChange={(nextPage) => setPage(Math.min(pageCount, nextPage))} /> : null}
      {editor !== undefined ? <ClassroomEditor onClose={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); setRefresh((value) => value + 1) }} room={editor} /> : null}
    </section>
  )
}
