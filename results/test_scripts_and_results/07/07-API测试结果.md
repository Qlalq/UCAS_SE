# API测试结果

- 测试目标：https://demo.4gaboards.com/login
- 测试分类：七、API
- 本轮 runId：1780044289060-qy69mw
- 执行时间：2026-05-29T08:44:49.060Z
- 执行方式：Playwright + Microsoft Edge；单 browser/context/page 顺序会话；API 用于模拟 Given 前置条件和交叉验证。

## 01. API认证

**结论：通过**

**Given**
- 持有有效Client ID/Secret

**When**
- 调用API

**Then**
- 期望：正确响应
- 实际：API认证 调用获得正确响应。

**执行验证**
- 无

**接口/数据验证**
- POST /api/api-clients 返回 200
- API认证 调用返回 200，响应：{"items":[{"id":"1782461958096684711","createdAt":"2026-05-25T02:53:43.000Z","updatedAt":"2026-05-27T03:27:41.000Z","name":"Getting started","background":null,"createdById":"1782461929894184612","updatedById":"1782461929894184612","isSubscribed":true,"backgroundImage":null},{"id":"1782485261691651075","createdAt":"2026-05-25T03:40:01.000Z","updatedAt":null,"name":"codex-probe-1779680392210","background":null,"createdById":"1782461929894184612","updatedById":null,"isSubscribed":true,"backgroundIm...

**截图**
- [01-api-board.png](D:\workspace\claude\lecture\SE\results\07-API\screenshots\01-api-board.png)

## 02. 权限控制

**结论：通过**

**Given**
- 用户无对应权限

**When**
- 调用API

**Then**
- 期望：返回403
- 实际：低权限 API client 调用受限接口被拒绝。

**执行验证**
- 无

**接口/数据验证**
- POST /api/api-clients 返回 200
- 权限控制 调用返回 401，响应：{"code":"E_UNAUTHORIZED","message":"Invalid client credentials"}

**截图**
- [02-api-board.png](D:\workspace\claude\lecture\SE\results\07-API\screenshots\02-api-board.png)

## 03. 创建卡片API

**结论：通过**

**Given**
- 已通过API认证

**When**
- 调用创建卡片API指定列表

**Then**
- 期望：卡片正确创建到指定列表
- 实际：创建卡片API 调用获得正确响应。

**执行验证**
- 无

**接口/数据验证**
- POST /api/api-clients 返回 200
- 创建卡片API 调用返回 200，响应：{"item":{"id":"1785538048344196769","createdAt":"2026-05-29T08:45:22.000Z","updatedAt":null,"position":81919,"name":"api-card-1780044289060-qy69mw","description":null,"dueDate":null,"timer":null,"commentCount":0,"isCreatedViaApi":true,"mailCreatorAddress":null,"boardId":"1785538019747432085","listId":"1785538025049032345","createdById":"1782461929894184612","updatedById":null,"coverAttachmentId":null}}

**截图**
- [03-api-board.png](D:\workspace\claude\lecture\SE\results\07-API\screenshots\03-api-board.png)

## 汇总

| 状态 | 数量 |
|---|---:|
| 通过 | 3 |

## 页面导航次数

本轮完整页面导航 3 次：
- api-board: https://demo.4gaboards.com/boards/1785537793842218598
- api-board: https://demo.4gaboards.com/boards/1785537906316674684
- api-board: https://demo.4gaboards.com/boards/1785538019747432085

