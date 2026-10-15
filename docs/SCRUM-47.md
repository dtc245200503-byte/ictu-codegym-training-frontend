# SCRUM-47 — Phân công giảng viên và trợ giảng

1. Người quản lý có quyền `CLASS_MANAGE` mở **Lớp học → Phân công**.
2. Với mỗi môn, chọn một **Giảng viên chính** và thêm các **Trợ giảng**. Có thể tìm theo tên/email trong dropdown khi danh sách dài. Bấm × trên thẻ trợ giảng để gỡ lựa chọn.
3. Bấm **Lưu phân công** khi tất cả các môn đã có giảng viên hợp lệ. Khi lỗi mạng hoặc backend từ chối, các lựa chọn được giữ để sửa và thử lại.
4. Bấm **Xem môn học** ở danh sách lớp để xem giảng viên và trợ giảng của từng môn.
5. Giảng viên/trợ giảng mở **Lớp của tôi** để xem lớp được phân công. Không hiển thị nút phân công cho tài khoản chỉ có vai trò giảng dạy.

Danh sách tài khoản được backend lọc theo vai trò và trạng thái khóa. Vai trò trợ giảng có thể được cấp qua **Quản lý tài khoản → Quản lý vai trò**; danh mục vai trò lấy từ API thay vì cố định ID trên giao diện.

Hộp thoại hỗ trợ Escape, giữ focus bàn phím, màn hình nhỏ và tùy chọn giảm chuyển động. Khi đang lưu, nút lưu và đóng bị khóa để tránh gửi trùng hoặc đóng trước khi có kết quả.

## Chạy và kiểm thử

```powershell
npm ci
npm run test:classes
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

Chạy cùng backend Scrum 47 ở cổng 8000. Kiểm thử DOM sử dụng dữ liệu giả, không cập nhật tài khoản hay lớp học thật.
