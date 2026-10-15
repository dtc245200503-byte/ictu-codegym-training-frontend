# SCRUM-41 — Chăm sóc khách hàng tiềm năng

Trong **Khách hàng tiềm năng**, chọn **Chăm sóc** ở một lead:

1. Chọn gọi điện, nhắn tin hoặc gặp trực tiếp; nhập nội dung và thời điểm tương tác.
2. Giữ lịch nhắc hiện tại, đặt lịch mới hoặc đánh dấu đã gọi lại để hoàn tất lịch nhắc khi lưu nhật ký.
3. Có thể đặt/đổi/bỏ lịch riêng trong thẻ **Lịch nhắc gọi lại**, không cần tạo tương tác.
4. Xem lịch sử, người thực hiện và thời điểm ghi nhận; lịch sử phân trang 20 bản ghi.

Ngày giờ luôn theo Việt Nam (UTC+7), kể cả khi thiết bị đang ở múi giờ khác. Lead quá hạn có nền nổi bật và nhãn chữ; nhãn kiểm tra lại mỗi 30 giây khi trang đang mở. Bộ lọc **Lịch gọi lại** hỗ trợ quá hạn, sắp gọi lại và chưa đặt lịch; được lưu trong URL và truy vấn lại khi thay đổi bộ lọc/trang hoặc sau khi lưu.

Nhật ký giữ nguyên khi lead chuyển cho tư vấn viên khác. API kiểm tra quyền theo người phụ trách; giao diện giữ bản nháp khi lưu lỗi, chặn gửi lặp trong lúc lưu, hỗ trợ bàn phím và giảm chuyển động theo cài đặt thiết bị.

## Kiểm tra

- `npm run test:leads`: kiểm thử DOM và chuyển đổi thời gian của Scrum 41.
- `npm run test:classes`: kiểm thử hồi quy Scrum 47.
- `npm run build`: kiểm tra TypeScript và tạo bản production.
- `npx eslint src/components/LeadCareDialog.tsx src/utils/leadCare.ts src/services/leadService.ts`: lint phần mới.

`LeadPage.tsx` có sẵn ba lỗi `react-hooks/set-state-in-effect` và `LeadFilters.tsx` có sẵn một lỗi `react-refresh/only-export-components` từ trước Scrum 41; được xác nhận trên bản HEAD trước thay đổi. Các kiểm thử DOM không thay thế kiểm tra bố cục trực tiếp trong trình duyệt.
