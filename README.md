# quiz-mln

Website quiz ôn tập Word/PDF bằng Next.js.

## Chạy local

```bash
npm install
npm run dev
```

## AI import bằng Google AI Studio

Tạo file `.env.local`:

```bash
GOOGLE_AI_API_KEY=your_google_ai_studio_api_key
GOOGLE_AI_MODEL=gemini-2.5-flash
```

Vào trang Import, upload PDF/DOCX hoặc dán text, sau đó chọn `Parse bằng AI`.

Bạn cũng có thể nhập Google AI key và Supabase publishable key trực tiếp trong trang `Cấu hình` của app. Cấu hình này lưu trong localStorage và ưu tiên hơn `.env`.

## Admin panel

Admin thật được lưu trong bảng `public.admin_users`. Để bootstrap admin đầu tiên, thêm email admin trong trang `Cấu hình` hoặc biến môi trường:

```bash
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,teacher@example.com
```

Sau khi user đã tồn tại trong Supabase Auth, chạy:

```bash
npm run admin:sync
```

Hoặc đăng nhập bằng email bootstrap rồi vào `/admin` bấm `Thêm tôi vào admin_users`.

## Tạo bảng Supabase bằng CLI

```bash
npm run supabase:link
npm run supabase:push
```

Nếu chưa đăng nhập Supabase CLI, chạy:

```bash
npx supabase@latest login
```

Hoặc dùng connection string Postgres trong `.env`:

```bash
SUPABASE_DB_URL=postgresql://postgres.qcqzfkqzllxaqgwrbary:YOUR_PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
npm run supabase:schema
```
