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
