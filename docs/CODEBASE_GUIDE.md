# JARVIS 代码说明

文档版本：V1.0  
更新日期：2026-09-29  
适用代码：前后端分离后的 JARVIS V0.5 工程。

## 1. 总体架构

```text
apps/frontend（React 工作台，可独立启动）
   │ 只依赖 @jarvis/contracts
packages/contracts（IPC 白名单、DTO、JarvisDesktopApi）
   │
apps/backend（Electron preload + main + 本地服务）
   ├── 模型网关 / 公告采集 / 知识与记忆 / 审批 / 日历 / DOCX
   │
Python voice sidecar（JSON Lines over stdio）
```

渲染进程不持有 API Key，也不能直接访问 Node.js。外部链接仅允许打开两个已列入白名单的政府采购官网。语音侧车不开放本地网络端口，只通过标准输入输出与主进程交换事件。

## 2. 核心目录

| 目录 | 作用 |
|---|---|
| `apps/backend/src/main/` | App 生命周期、窗口、菜单栏、快捷键与 IPC 注册 |
| `apps/backend/src/preload/` | 按共享契约向前端暴露最小化 API |
| `apps/backend/src/services/models/` | Provider 保存、`safeStorage`、当前模型和 Chat Completions 网关 |
| `apps/backend/src/services/voice/` | 系统 TTS、语音状态控制、sidecar 协议和进程管理 |
| `apps/backend/src/services/crawler/` | 中国政府采购网与宁夏政府采购网采集、相关性和去重 |
| `apps/backend/src/services/knowledge/` | 公司资料切块、索引和本地检索 |
| `apps/backend/src/services/memory/` | 长期记忆策略与本地持久化 |
| `apps/backend/src/services/approvals/` | 有时效、动作绑定、一次性消费的审批令牌 |
| `apps/backend/src/services/calendar/` | macOS 日历只读桥接 |
| `apps/backend/src/services/documents/` | 八章项目建议书 DOCX 生成 |
| `apps/frontend/src/features/` | 助理、项目、资料、文档、日历、设置工作台 |
| `apps/frontend/src/platform/browserMock.ts` | 前端独立开发使用的无外部副作用 Mock |
| `packages/contracts/src/index.ts` | IPC 通道、DTO 和前端 API 接口，是跨团队唯一共享边界 |
| `sidecar/` | Whisper 麦克风识别、唤醒匹配与性能测试 |
| `knowledge/company/` | 公司基础资料库，正式证据挂接前只作初筛 |

## 3. 关键运行链路

### 唤醒与语音

1. Electron 启动 `VoiceSidecarManager`。
2. sidecar 加载 faster-whisper，在本机进行音频分段和转写。
3. 拼音模糊匹配命中唤醒词后发送 `wake` 事件。
4. 主进程显示窗口，并用 macOS `say` 播放固定回应。
5. 当前尚未把后续 transcript 自动送入模型；文字输入链路已经可用。

### 模型调用

1. 设置页保存 Provider，API Key 由主进程用 `safeStorage` 加密。
2. `ProviderRepository` 标记当前 Provider。
3. `ModelGateway` 向 `{baseUrl}/chat/completions` 发起请求。
4. 所有模型共享同一 JARVIS 人格提示，切换模型不改变称呼和权限。

### 公告采集

1. `CrawlerService` 并发读取两个来源。
2. 任一来源失败时保留该来源的上次本地快照。
3. `noticeUtils` 按来源与公告 ID 去重，并基于信息化关键词标记初步相关性。
4. 当前只完成列表级事实，未核验详情字段时统一显示“详情页待核验”。

### 审批

`ApprovalService` 创建动作绑定的短期令牌。令牌必须处于 `approved` 状态、动作匹配、未过期，并且只能消费一次。当前日历首次只读访问已经使用该机制；后续修改、删除、上传、发送和日历写入必须复用该服务。

## 4. 本地开发

### Node 依赖

```bash
npm install
npm run typecheck
npm test
npm run dev:desktop
```

只启动前端：

```bash
npm run dev:frontend
```

只运行对应测试：

```bash
npm run test:frontend
npm run test:backend
```

显式执行真实网站测试：

```bash
RUN_LIVE=1 npx vitest run tests/liveCrawler.test.ts
```

### 本地语音环境

项目不提交虚拟环境和模型缓存。Intel Mac 推荐使用 Python 3.12：

```bash
uv venv --python 3.12 .voice-venv
.voice-venv/bin/python -m pip install faster-whisper==1.2.1 sounddevice==0.5.6 pypinyin==0.55.0
```

如果 Python 不在 `.voice-venv/bin/python`，可用 `JARVIS_VOICE_PYTHON` 指定。模型首次运行会下载到本机缓存；该动作需要联网。

语音基准测试：

```bash
.voice-venv/bin/python sidecar/benchmark_whisper.py /path/to/sample.wav --model tiny
```

## 5. 数据位置与安全

- Provider、记忆和公告快照位于 Electron `userData/private/`。
- 私有 JSON 写入权限为 `0600`，采用临时文件后原子替换。
- 公司资料默认从 `knowledge/company/宁夏希望信息产业股份有限公司/` 读取，也可通过 `JARVIS_KNOWLEDGE_ROOT` 覆盖。
- API Key 不应出现在日志、截图、错误提示、前端状态或测试夹具中。
- 新增外发、上传、删除、修改和权限能力时，先接审批服务，再接实际执行器。

## 6. 构建与打包

```bash
npm run build
npm run pack:mac:x64
```

当前 `electron-builder` 只打包 `out/**/*` 和 `package.json`，不会自动包含 Python 运行时、sidecar 依赖和 Whisper 模型。因此开发模式可完整演示本地唤醒，但发布包仍需设计 `extraResources`、签名、公证和首次模型安装流程。

## 7. 测试策略

- 默认测试不得依赖网络。
- 采集解析、模型协议、审批、记忆策略和文档生成使用确定性单元测试。
- 真实官网测试通过 `RUN_LIVE=1` 显式启用。
- 每个阶段至少执行 `npm run typecheck`、`npm test` 和 `npm run build`。
- 前后端接口变更必须先修改 `packages/contracts`，不得由前端直接导入后端实现类型。

## 8. 下一步建议

优先顺序：公告详情抽取 → 项目可投性诊断 → 语音 transcript 接模型 → 招标文件人工验证码协同 → 日历确认后写入 → 打包语音运行时。这样最先形成“发现项目、判断能否做、生成方案、提醒节点”的完整演示闭环。
