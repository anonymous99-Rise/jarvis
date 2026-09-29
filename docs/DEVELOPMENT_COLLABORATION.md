# JARVIS 协作开发规范

## 结论

工程已拆分为前端、后端、共享契约和语音侧车四个可独立认领的区域。前端不能导入后端实现，后端不能依赖前端组件；任何跨层变化先修改共享契约。

## 团队边界

| 角色 | 主要目录 | 可以独立完成的工作 |
|---|---|---|
| 前端 | `apps/frontend/` | 页面、交互、状态、样式、浏览器 Mock、前端测试 |
| 后端 | `apps/backend/` | Electron、IPC 实现、本地服务、安全和系统能力 |
| 接口负责人 | `packages/contracts/` | IPC 通道、请求响应 DTO、`JarvisDesktopApi` |
| 语音 | `sidecar/`、后端 `services/voice/` | 唤醒、STT、TTS、进程协议和性能测试 |
| 测试 | `tests/` | 跨层契约、服务单元测试和显式联网测试 |

`knowledge/`、`docs/product/` 和真实用户资料默认只读。修改、删除、上传或外发仍遵循 sir 的确认规则。

## 启动方式

完整桌面端：

```bash
npm run dev:desktop
```

只开发前端：

```bash
npm run dev:frontend
```

前端地址为 `http://127.0.0.1:5174/`。该模式使用 `browserMock.ts`：不会调用真实模型、不会访问系统权限、不会写文件，也不会向外发送资料。Mock 内容必须继续明确标记为联调数据。

## 接口变更流程

1. 在 `packages/contracts/src/index.ts` 新增或修改 DTO、IPC 通道或 API 方法。
2. 运行 `npm run typecheck`，确认契约自身有效。
3. 后端在 preload 和 main IPC 中实现契约。
4. 后端增加确定性测试，外部网站测试默认不得自动联网。
5. 前端接入方法并更新浏览器 Mock。
6. 运行全量门禁：

```bash
npm run typecheck
npm test
npm run build
```

不允许先在前端写一个私有请求结构、再让后端猜字段；也不允许前端从 `apps/backend` 导入类型。

## 分支与提交建议

当前目录尚未初始化 Git 仓库。sir 确认托管位置后，建议采用短分支：

- `feat/frontend-项目卡片`
- `feat/backend-公告详情`
- `feat/contracts-项目详情`
- `fix/voice-唤醒延迟`

一次提交只覆盖一个可验证目标。涉及 `packages/contracts` 的合并请求必须由前后端各一人评审；仅改前端样式或后端内部算法时，不要求另一端同步修改。

## 冲突控制

- 前端成员避免修改 `apps/backend`。
- 后端成员避免修改 `apps/frontend`。
- 共享契约文件保持小步修改，不在同一提交混入业务重构。
- `package-lock.json` 只在依赖实际变化时提交。
- 真实公司资料、API Key、Electron `userData`、`.voice-venv`、模型缓存和构建产物不得进入仓库。

## 验收基线

- `npm run typecheck`：contracts、backend、frontend 和测试根配置全部通过。
- `npm run test:frontend`：前端状态机测试通过。
- `npm run test:backend`：后端确定性测试通过，联网测试跳过。
- `npm run build`：main、preload、renderer 三段构建通过。
- `npm run dev:frontend`：无需 Electron 和密钥即可打开工作台。
- `npm run dev:desktop`：Electron 正常启动并继续使用真实本地服务。
