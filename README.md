# JARVIS 个人全能智能助理

这是 JARVIS V0.5 macOS 演示版的独立项目目录。当前定位不是单一招投标工具，而是 sir 的个人 AI 全能助理；项目指挥、知识库、文档生成和日历只是首批工作台。

## 当前能力

- Electron 菜单栏常驻、窗口隐藏和快捷键唤醒。
- 本地唤醒词监听与固定英文回应：`I'm always here, sir.`
- OpenAI 兼容模型配置、密钥加密保存、运行时模型切换。
- 文字输入 → 模型 → 本地 TTS 的对话链路。
- 中国政府采购网、宁夏政府采购网公开公告低频采集。
- 宁夏希望信息产业股份有限公司本地资料检索和长期记忆。
- 修改、删除、上传、发送、权限与日历写入的统一审批模型。
- macOS 系统日历只读连接；首次权限访问由 sir 明确确认。
- 按八章提纲生成可编辑的政务信息化项目建议书 DOCX。

## 开发启动

```bash
npm install
npm run typecheck
npm test
npm run dev:desktop
```

前端成员无需启动 Electron，可直接运行：

```bash
npm run dev:frontend
```

浏览器开发模式自动装载明确标注的本地 Mock，不调用真实模型、不读取系统日历、不写本地文件。

本地语音运行环境需要另行建立，详见 [代码说明](docs/CODEBASE_GUIDE.md)。

## 目录

- `apps/frontend/`：React 工作台，可独立在浏览器中开发。
- `apps/backend/`：Electron 主进程、预加载桥接和全部本地服务。
- `packages/contracts/`：前后端共享的 IPC 通道、DTO 和 `JarvisDesktopApi`。
- `sidecar/`：本地语音 Python 侧车。
- `tests/`：单元、集成与显式联网测试。
- `knowledge/company/`：公司本地基础资料库。
- `docs/product/`：产品定位、架构、V0.5 范围和文档模板。
- `docs/plans/`：开发实施计划与开源组合计划。

项目记忆见 [PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)，代码架构见 [CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md)，协作规范见 [DEVELOPMENT_COLLABORATION.md](docs/DEVELOPMENT_COLLABORATION.md)。
