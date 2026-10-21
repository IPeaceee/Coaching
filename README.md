# Coaching Academy

Nền tảng học tập tĩnh (HTML/CSS/JS thuần, không cần build) gồm nhiều khóa học, deploy lên GitHub Pages:

- Trang chủ: https://ipeaceee.github.io/Coaching/
- Linux LPIC-1: https://ipeaceee.github.io/Coaching/lpi1-course/

## Cấu trúc

```text
Coaching/
├── index.html                 # Trang chủ: header, hero, danh mục khóa học, giới thiệu
├── 404.html                   # Trang lỗi (GitHub Pages dùng cho mọi URL không tồn tại)
├── courses.json               # Danh mục khóa học — nguồn dữ liệu duy nhất của trang chủ
├── assets/
│   ├── css/academy.css        # Giao diện trang chủ (sáng/tối, responsive)
│   ├── js/academy.js          # Đọc courses.json và vẽ thẻ khóa học
│   └── images/logo.svg
├── lpi1-course/               # Khóa Linux LPIC-1 (slide, lab, trắc nghiệm) — tự chứa
│   ├── index.html             # Trang giới thiệu khóa + lộ trình 4 giai đoạn / 14 buổi
│   ├── buoi-01.html … buoi-14.html
│   ├── quiz.html
│   └── assets/                # deck.css, deck.js, quiz.js, quiz-data.js
├── tools/check-site.mjs       # Kiểm tra link, asset, courses.json (chạy cả trên CI)
└── .github/workflows/deploy.yml
```

Mọi đường dẫn nội bộ đều là **đường dẫn tương đối** (`lpi1-course/`, `assets/css/academy.css`), nên site chạy đúng dưới `/Coaching/`, dưới tên miền riêng hay trên máy cá nhân mà không phải sửa gì. Không dùng đường dẫn bắt đầu bằng `/`.

## Xem trước trên máy

```bash
python -m http.server 8000
# mở http://localhost:8000/
```

Trang chủ đọc `courses.json` bằng `fetch`, nên cần một web server; mở trực tiếp file `index.html` từ ổ đĩa sẽ không hiện danh mục. Các slide trong từng khóa thì mở trực tiếp được.

Trước khi push, chạy bộ kiểm tra (cần Node.js 18+):

```bash
node tools/check-site.mjs
```

## Thêm một khóa học mới

1. Tạo thư mục khóa học ở gốc repo, ví dụ `security/`, có ít nhất `security/index.html`. Mỗi khóa tự chứa CSS/JS/ảnh của mình trong thư mục đó và chỉ dùng đường dẫn tương đối.
2. Thêm một mục vào `courses.json`:

   ```json
   {
     "id": "security",
     "title": "Security Fundamentals",
     "subtitle": "Mô tả ngắn một dòng",
     "description": "Mô tả 1–2 câu hiển thị trên thẻ khóa học.",
     "path": "security/",
     "status": "draft",
     "level": "Trung cấp",
     "modules": 3,
     "lessons": 10,
     "duration": "~30 giờ",
     "glyph": "#!",
     "color": "#7c3aed",
     "tags": ["Security"],
     "links": []
   }
   ```

   | Trường | Ý nghĩa |
   | --- | --- |
   | `status` | `published`: hiện và có nút "Bắt đầu học" · `coming-soon`: hiện thẻ mờ "Sắp ra mắt", không có link · `draft`: ẩn khỏi trang chủ |
   | `path` | Đường dẫn tương đối tới thư mục, kết thúc bằng `/` |
   | `glyph`, `color` | Ký tự lớn và màu (hex) của ảnh thu nhỏ trên thẻ |
   | `links` | Nút phụ trên thẻ, ví dụ `{ "label": "Thi thử", "path": "security/quiz.html" }` |

3. Trong trang `index.html` của khóa, thêm link quay về học viện: `<a href="../index.html#courses">← Coaching Academy</a>`.
4. Chạy `node tools/check-site.mjs`, sửa lỗi nếu có, rồi commit và push lên `main`. Khi nội dung sẵn sàng, đổi `status` sang `published`.

## Deploy

Workflow `.github/workflows/deploy.yml` chạy khi push lên `main` (và có thể chạy tay trong tab Actions):

1. `node tools/check-site.mjs`: nếu có link hoặc asset hỏng thì dừng, không deploy.
2. Sao chép toàn bộ repo (trừ `.git`, `.github`, `tools`, `README.md`) vào `_site/`.
3. Đẩy `_site/` lên GitHub Pages.

Pull request vào `main` chỉ chạy bước kiểm tra, không deploy.

Cấu hình một lần trên GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
