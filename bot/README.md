# KunquWiki Bot

这是用于批量导入与检查的机器人客户端。它读取固定结构的 JSON 文件，进行本地预校验，并调用后端 Bot API 完成导入或检查。

## 目录结构

- `main.py`：CLI 入口
- `config.py`：配置读取
- `client/api_client.py`：后端 API 客户端
- `importer/`：JSON 读取、校验、提交
- `checks/`：检查能力
- `models/`：数据结构
- `utils/`：日志、重试
- `samples/`：示例 JSON
- `tests/`：基础测试

## 安装

```bash
cd bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 配置

复制 `.env.example` 为 `.env` 并按需修改：

- `BOT_BACKEND_BASE_URL`：后端地址
- `BOT_API_TOKEN`：后端 Bot Token
- `BOT_TIMEOUT`：请求超时（秒）
- `BOT_BATCH_SIZE`：批量提交大小
- `BOT_RETRY_COUNT`：重试次数

## JSON 结构

示例见 `samples/sample_input.json` 与 `samples/sample_input_full.json`。

基础结构：

```json
{
  "items": [
    {
      "external_id": "CITY_SH_001",
      "entity_type": "city",
      "title": "上海",
      "initial_data": {
        "province": "上海市"
      }
    }
  ]
}
```

### 字段说明

- `items`：顶层数组，必填
- `external_id`：外部系统标识，可选，用于回溯
- `entity_type`：实体类型（`city`/`troupe`/`venue`/`work`/`person`/`article`/`event`/`role`）
- `title`：标题，必填
- `work_type`：仅 `work` 使用，如 `full_play` / `excerpt`
- `parent_work_id`：折子戏（`work_type=excerpt`）必填
- `initial_data`：补充字段对象，对应后端快速创建逻辑

### 常见 initial_data 字段示例

- `city`：`province`
- `troupe`：`troupeType`、`cityId`、`region`、`description`
- `venue`：`venueType`、`cityId`、`address`、`capacity`
- `work`：`synopsis`、`plot`、`originalAuthor`、`dynastyPeriod`
- `person`：`gender`、`birthDate`、`personIdentities`、`troupeMemberships`
- `event`：`startAt`、`eventType`、`businessStatus`、`cityId`、`venueEntityId`、`troupeIds`

### 名称解析与对照表

开启 `--resolve` 后，bot 会在提交前把 `cityId`/`troupeIds`/`venueEntityId` 等字段里的“名称”解析为实体 ID。

支持两种来源：

- `search`：调用后端 `/api/search` 做查询（默认）
- `map`：读取本地对照表

对照表示例（JSON）：

```json
{
  "city": { "苏州": "cxxxxxxxxxxxxxxxxxxxxxxxx" },
  "troupe": { "上海昆剧团": "cxxxxxxxxxxxxxxxxxxxxxxxx" },
  "venue": { "苏州昆剧院": "cxxxxxxxxxxxxxxxxxxxxxxxx" },
  "person": { "俞振飞": "cxxxxxxxxxxxxxxxxxxxxxxxx" },
  "work": { "牡丹亭": "cxxxxxxxxxxxxxxxxxxxxxxxx" },
  "role": { "杜丽娘": "cxxxxxxxxxxxxxxxxxxxxxxxx" }
}
```

### 搜索缓存

当 `--resolve` 开启且包含 `search` 模式时，会先调用 `/api/search` 预热并把结果缓存到本地，后续解析优先使用缓存。

- 默认缓存路径：`bot/cache/search_cache.json`
- 可指定目录：`--cache-dir /path/to/cache`

### 导入安全策略

- 默认 `dry-run`，不会写入后端。
- 只有加 `--commit` 才会提交写入。
- `dry-run` 下，如果发现无法解析的城市/剧团/演员/角色等引用，会输出 **warning**，但不会阻断流程。

## 如何添加 JSON 文件

1. 在任意目录新建 JSON 文件（推荐放在 `bot/samples/` 或项目数据目录）。
2. 按上述结构填写 `items`。
3. 使用命令导入或检查：

```bash
python main.py import --file ./samples/sample_input.json
python main.py check --file ./samples/sample_input_full.json --type schema
```

## 使用

导入（默认 dry-run，不写入后端）：

```bash
python main.py import --file ./samples/sample_input.json
```

写入后端（显式提交）：

```bash
python main.py import --file ./samples/sample_input.json --commit
```

名称自动解析（把“苏州/上海昆剧团”等解析为实体 ID）：

```bash
python main.py import --file ./samples/sample_input.json --resolve
python main.py import --file ./samples/sample_input.json --resolve --resolve-mode map --map-file ./mappings/entity_map.json
```

仅校验结构：

```bash
python main.py check --file ./samples/sample_input.json --type schema
```

业务检查（会访问后端）：

```bash
python main.py check --file ./samples/sample_input.json --type business
python main.py check --file ./samples/sample_input.json --type business --resolve
```

系统健康检查：

```bash
python main.py check --type health
```

## 常见错误

- `Bot API token is not configured`：后端未配置 `BOT_API_TOKEN`
- `Invalid bot token`：Bot Token 与后端配置不一致
- `entityType is required`：JSON 结构字段缺失
