# ICTU × CodeGym — Cổng quản lý đào tạo

React + TypeScript frontend for the training-management portal.

## Chạy giao diện

1. Khởi động backend FastAPI và MySQL theo hướng dẫn trong [`../backend/README.md`](../backend/README.md).
2. Sao chép `.env.example` thành `.env.local` nếu API không chạy tại `http://localhost:8000/api`.
3. Chạy các lệnh:

   ```powershell
   npm install
   npm run dev
   ```

Đăng nhập bằng tài khoản quản trị đã khởi tạo ở backend. Giao diện gọi API thật để đăng nhập, làm mới/thu hồi phiên, đổi mật khẩu, quản lý tài khoản, nhập Excel, môn học, lớp học phần, danh sách học viên và thời khóa biểu.

Build production: `npm run build` · Kiểm tra lint: `npm run lint`.
