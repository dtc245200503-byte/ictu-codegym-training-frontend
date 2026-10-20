module.exports = (changes = {}) => ({
  code: 'schedule_conflict', message: 'Lịch bị trùng.', can_override: true, conflict_token: 'a'.repeat(64),
  conflicts: [{
    candidate: { session_id: 1, class_name: 'Lớp Python', subject_name: 'Python', topic: 'Thực hành', session_date: '2026-10-16', start_time: '08:00', end_time: '09:30', room_name: 'P.201', staff: [{ user_id: 2, name: 'Cô An' }] },
    existing: { session_id: 22, class_name: 'Lớp Java <script>', subject_name: 'Java', topic: 'Buổi Java', session_date: '2026-10-16', start_time: '09:00', end_time: '10:00', room_name: 'P.201', staff: [{ user_id: 2, name: 'Cô An' }] },
    reasons: ['instructor', 'room'], instructors: [{ user_id: 2, name: 'Cô An' }], unknown_duration: false,
  }], ...changes,
})
