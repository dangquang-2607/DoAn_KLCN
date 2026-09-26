# Baseline tái cấu trúc `capitalflow-api`

Ngày ghi nhận: 23/09/2026.

Tài liệu này lưu mốc kỹ thuật trước khi thực hiện kế hoạch tái cấu trúc backend. Đây không phải báo cáo release và không thay thế các runbook vận hành.

## Kết quả kiểm tra

- `python -m compileall -q app scripts tests`: đạt.
- `python -m pytest -q`: 95 test đạt, 1 cảnh báo deprecation, thời gian 7,08 giây.
- Docker base image: `python:3.12-slim-bookworm`.
- Liveness endpoint: `/health`.
- Readiness endpoint: `/ready`.
- Docker Compose healthcheck sử dụng `/ready`.
- OpenAPI hiện công bố 58 đường dẫn, bao gồm toàn bộ package admin mới.

Sau khi bổ sung kiểm thử liveness/readiness trong đợt tái cấu trúc, suite hiện có **97 test đạt**. Mốc 95 phía trên vẫn được giữ để thể hiện baseline ban đầu, không phải mục tiêu cuối.

## Phạm vi cần bảo toàn

- API routes, bao gồm package `app/api/routes/admin/`.
- Worker lanes: OCR và nhóm EMAIL/BUDGET/FILE_DELETE/USER_PURGE/USER_FILE_PURGE.
- Transaction locking, idempotency và tính toàn vẹn số dư.
- Refresh-token rotation và cơ chế phát hiện token bị tái sử dụng.
- Migration locks, hooks biến đổi dữ liệu và khả năng chạy lại an toàn.
- Unicode tiếng Việt, schema contract và production Docker artifact.

## Trạng thái worktree

Worktree đã có nhiều thay đổi và file chưa theo dõi trước khi giai đoạn này bắt đầu. Các thay đổi đó được coi là dữ liệu của người dùng, không được hoàn tác hoặc ghi đè chỉ để làm sạch Git.

Mọi đợt tiếp theo phải so sánh với baseline này, chạy lại compile/test và ghi rõ nếu số lượng test thay đổi có chủ đích.

## Kết quả sau tái cấu trúc ngày 25/09/2026

- Source runtime chỉ còn ba nhánh cấp cao: `bootstrap`, `modules` và `shared`.
- Các import từ `app.api`, `app.core`, `app.models`, `app.schemas` và `app.services` đã được loại bỏ.
- Worker chuyển sang điểm vào `app.modules.jobs.runner` và Docker Compose đã được cập nhật tương ứng.
- Test, script và tài liệu đã được nhóm lại theo module/mục đích.
- `python -m compileall -q app scripts tests`: đạt.
- `python -m pytest -q`: 97 test đạt, 1 cảnh báo deprecation từ Starlette TestClient.
- OpenAPI tiếp tục có 58 paths và 74 operations.
- `docker compose config --quiet` và CLI `python -m app.modules.jobs.runner --help`: đạt.

Không có DDL/DML hoặc thao tác phá hủy dữ liệu nào được thực hiện trong giai đoạn tái cấu trúc này.
