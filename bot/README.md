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

## 如何添加 JSON 文件

1. 在任意目录新建 JSON 文件（推荐放在 `bot/samples/` 或项目数据目录）。
2. 按上述结构填写 `items`。
3. 使用命令导入或检查：

```bash
python main.py import --file ./samples/sample_input.json
python main.py check --file ./samples/sample_input_full.json --type schema
```

## 使用

导入：

```bash
python main.py import --file ./samples/sample_input.json
```

仅校验结构：

```bash
python main.py check --file ./samples/sample_input.json --type schema
```

业务检查（会访问后端）：

```bash
python main.py check --file ./samples/sample_input.json --type business
```

系统健康检查：

```bash
python main.py check --type health
```

## 常见错误

- `Bot API token is not configured`：后端未配置 `BOT_API_TOKEN`
- `Invalid bot token`：Bot Token 与后端配置不一致
- `entityType is required`：JSON 结构字段缺失
