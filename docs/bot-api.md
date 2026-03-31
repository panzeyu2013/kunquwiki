# Bot API 接入说明

## 开启方式

后端需配置以下环境变量（示例见 `apps/api/.env.example`）：

- `BOT_API_ENABLED=true`
- `BOT_API_TOKEN=...`
- `BOT_ACTOR_USERNAME=bot`（可选，默认 `bot`）
- `BOT_ACTOR_ID=...`（可选，优先级高于用户名）

## 鉴权

使用 Header 传递 Token：

- `X-Bot-Token: <BOT_API_TOKEN>`

也支持 `Authorization: Bearer <BOT_API_TOKEN>` 形式。

## 接口

### 批量导入

`POST /api/bot/import`

请求体示例：

```json
{
  "items": [
    {
      "externalId": "CITY_SH_001",
      "entityType": "city",
      "title": "上海",
      "initialData": {
        "province": "上海市"
      }
    }
  ],
  "options": {
    "dryRun": false,
    "upsert": true
  }
}
```

响应示例：

```json
{
  "success": true,
  "summary": {
    "total": 1,
    "successCount": 1,
    "failedCount": 0
  },
  "results": [
    {
      "index": 0,
      "externalId": "CITY_SH_001",
      "entityType": "city",
      "title": "上海",
      "success": true,
      "message": "created"
    }
  ]
}
```

### 统一检查

`POST /api/bot/check`

请求体示例：

```json
{
  "checkType": "schema",
  "items": [
    {
      "entityType": "city",
      "title": "上海"
    }
  ]
}
```

响应示例：

```json
{
  "success": true,
  "checkType": "schema",
  "passed": true,
  "errors": [],
  "warnings": [],
  "stats": {
    "total": 1,
    "errorCount": 0,
    "warningCount": 0
  }
}
```

### 系统检查

`GET /api/bot/check/health`

响应示例：

```json
{
  "ok": true,
  "service": "kunquwiki-api",
  "database": {
    "ok": true
  }
}
```
