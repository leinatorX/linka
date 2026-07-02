# Linka

Save it. Let AI organize it.

Linka 是一款极致轻量的 AI 驱动书签管理器。你只需要收藏链接，Linka 会自动抓取网页信息，并生成摘要、分类和标签，再以卡片形式展示。

## 当前功能

- Vue 3 + Vite + TypeScript 前端。
- Node.js + Fastify + TypeScript 后端。
- SQLite 本地持久化。
- 手动添加 URL 收藏。
- 自动抓取标题、描述、favicon 和封面图。
- 有 `OPENAI_API_KEY` 时调用 OpenAI 兼容接口生成摘要、分类和标签。
- 没有 AI Key 时使用本地兜底规则，保证应用可以先跑起来。
- 首页卡片展示、关键词搜索、分类筛选、标签筛选。
- AI 助手支持通过对话收藏链接和搜索已收藏内容。
- Docker Compose 部署，适合群晖 NAS。

## 本地开发

```bash
npm install
npm run dev
```

默认地址：

- 前端开发服务：http://localhost:5173
- 后端 API：http://localhost:3030

## 环境变量

复制 `.env.example` 为 `.env`，按需填写：

```env
LINKA_PORT=3030
LINKA_HOST=0.0.0.0
LINKA_DB_PATH=./data/linka.sqlite
LINKA_APP_URL=http://localhost:3030

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

LINKA_API_TOKEN=
```

说明：

- `OPENAI_API_KEY` 为空时，Linka 仍可使用，但摘要和分类会使用本地兜底规则。
- `LINKA_API_TOKEN` 设置后，外部客户端调用 `POST /api/bookmarks` 需要携带 `Authorization: Bearer <token>`。
- 第一版默认单用户自托管场景，不包含完整登录系统。

## 构建

```bash
npm run build
npm run start
```

生产服务默认运行在：

```text
http://localhost:3030
```

## Docker 部署

```bash
docker compose up -d --build
```

数据会持久化到本地 `./data` 目录。群晖 NAS 部署时，建议把该目录映射到共享文件夹，便于备份。

## API 示例

新增收藏：

```bash
curl -X POST http://localhost:3030/api/bookmarks \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://example.com\",\"source\":\"web\"}"
```

如果配置了 `LINKA_API_TOKEN`：

```bash
curl -X POST http://localhost:3030/api/bookmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d "{\"url\":\"https://example.com\",\"source\":\"chrome-extension\"}"
```

## Chrome 扩展预留

后续 Chrome 扩展只需要读取当前页面 URL 和标题，然后调用：

```http
POST /api/bookmarks
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "url": "https://example.com",
  "title": "当前页面标题",
  "source": "chrome-extension"
}
```

AI Key 不会放进扩展，所有 AI 调用都在 Linka 后端完成。
