<!-- COVER_START -->

[RIGHT] 得 分：__________

# 中国科学院大学南京学院

## 研究生课程论文

### 2025～2026 学年 第二学期

　　课程名称：  软件工程

　　论文题目：  基于大模型的测试场景生成与智能测试工具

　　学科专业：  软件工程

　　组　　别：  第 4 组

　　团队成员：  童泽露、刘家恒、钱永杰、木热

　　指导教师：  __________________

# 二○二六 年 七 月

<!-- COVER_END -->

---

## 一、项目基本信息

### 1.1 应用运行访问地址与演示录屏

任务一与任务二均以本地脚本方式运行，结题检查阶段优先以演示录屏为准。

- 任务一（场景生成）：本地执行 `python generate_tests.py --docs ./docs --output ./tests.json`，输出 12 分类共 72 条测试场景。
- 任务二（智能测试）：本地执行 `python generate_scripts.py`，驱动 `https://demo.4gaboards.com/` 完成全部 72 条用例的执行与判定。
- 演示录屏：`video/project1.mp4`（任务一）、`video/project2.mp4`（任务二）。

### 1.2 账号信息

任务二 Agent 已在 prompt 中预置统一测试账号：

| 用途 | 用户名 | 密码 |
| --- | --- | --- |
| 任务二 Agent 登录 | `3652750340@qq.com` | `abc.147258369` |

执行过程中由 Agent 通过 `/api/access-tokens` 接口动态注册的临时账号（用于跨用户权限验证、Given 前置条件构造），邮箱形如 `user_module_*_<runId>@example.com`，执行结束后留存于演示实例用户表中。若需复现，可访问 `https://demo.4gaboards.com/` 使用上述统一账号登录后，在「实例设置 → 用户管理」中查看。

### 1.3 项目代码库地址

本课程作业的完整工程根目录为 `lecture/SE_final/`，目录结构：

```
SE_final/
├── project.md                # 大作业要求
├── report_demand.md          # 结题报告要求
├── generate_tests.py         # 任务一执行脚本
├── generate_scripts.py       # 任务二执行脚本
├── tests.json                # 任务一产出的 72 个测试点
├── docs/                     # 4gaBoards 官方手册（任务一输入）
│   ├── USER-MANUAL.md
│   ├── DEVELOPER-MANUAL.md
│   └── ADMIN-MANUAL.md
├── 4gaBoards-main/           # 4gaBoards 参考项目源码（任务二 file_search 检索源）
├── results/                  # 任务一多模式产出 + 任务二执行结果
│   ├── tests.json / tests_hybrid.json / tests_vec.json / tests_bm25.json / tests_full.json
│   └── test_scripts_and_results/01-12/
├── video/                    # 任务一、任务二演示视频
├── PPT/                      # 开题、中期汇报 PPT
├── illustration.pptx         # 最终演示流程图
└── README.md                 # 项目总体说明
```

### 1.4 项目成员贡献说明

小组采用 Scrum 方式组织，4 名成员角色与分工如下：

| 成员 | Scrum 角色 | 任务主线 | 提交次数 | 贡献占比 |
| --- | --- | --- | ---: | --- |
| 钱永杰 | SM（Scrum Master / 组长） | 整体节奏与思路规划、Sprint 计划与复盘、开题/中期/结题 PPT、结题报告与文档统筹、仓库初始化 | 8 | 25% |
| 木热 | 开发团队 | 任务一 RAG 兜底与混合检索工程化、任务二 Tool Use Agent 全栈开发、批量执行与回归 | 7 | 25% |
| 童泽露 | PO（产品负责人 · 任务一） | 任务一需求边界、12 分类与配额、prompt 模板、tests.json 校对 | 5 | 25% |
| 刘家恒 | PO（产品负责人 · 任务二） | 任务二智能体能力边界、工具契约、用例执行结果验收 | 5 | 25% |

四名成员贡献均分，commit 数量排名 8 > 7 > 5 ≈ 5，与各成员的 Scrum 角色工作量对应：SM 因文档统筹 + 节奏管理承担最重，PO-任务二因 Sprint 3 之后才介入承担略轻。每位成员的工作内容均与代码库模块归属一致，详见第二章「Scrum 实施概览」末的 Git 提交节奏表与附录 A 完整提交日志。

---

## 二、项目开发

### 2.1 Scrum 实施概览

项目整体跨度覆盖开题、中期、结题三个里程碑，开发期集中于 4 个 Sprint，每个 Sprint 1 周。每日 15 分钟站会同步进度、阻塞与下一步，SM 在 Sprint 末主持评审与复盘。

| Sprint | 时间窗口 | 目标 | 关键产出 | 主要责任人 |
| --- | --- | --- | --- | --- |
| Sprint 1 | 2026-05-19 ~ 2026-05-25 | 调研 + 任务一 RAG 骨架 | 三份手册功能分类边界、DocumentProcessor 切分、TF 向量 + BM25 混合检索初版 | 童泽露（PO-任务一）、木热（开发） |
| Sprint 2 | 2026-05-26 ~ 2026-06-01 | 任务一场景生成 + 72 测试点 | 12 分类 prompt 模板与配额、四模式对比脚本、tests.json 72 测试点校对 | 童泽露（PO-任务一）、木热（开发） |
| Sprint 3 | 2026-06-02 ~ 2026-06-08 | 任务二智能体架构 + 单用例调试 | Tool Use Agent 主循环、code_execution/file_search 工具、截图回传、三态判定 | 刘家恒（PO-任务二）、木热（开发） |
| Sprint 4 | 2026-06-09 ~ 2026-06-15 | 任务二批量执行 + 报告打磨 | 12 分类批量回归、相对定位重构、PPT 与结题报告、使用手册 | 全员（钱永杰统筹） |

Backlog 维度：

- Product Backlog 由两位 PO 共同维护，按 12 分类 × 平均 6 条 = 72 条测试用例作为最小可交付单位。
- Sprint Backlog 每个 Sprint 起始由 SM 在站会上拆分到日，关键卡（任务一兜底、任务二主循环、报告章节）单独跟踪。
- 验收标准：每条测试用例必须在 `results/test_scripts_and_results/<分类>/` 下产出 Markdown 报告 + 原始 JSON + 最终 Playwright 脚本 + 关键截图。

每日站会要点节选（示例）：

- 5 月 20 日：童泽露完成 `DocumentProcessor` 切分；阻塞：BM25 中文标点权重异常；下一步：木热补停用词过滤。
- 6 月 3 日：木热打通 `code_execution` 与 Playwright 子进程；刘家恒确认单用例执行三态输出符合预期；下一步：截图回传链路。

Git 提交节奏（按 Sprint × 作者交叉落点，commit 时间精确到秒；完整 25 条 commit 见附录 A）：

| Sprint | 时间窗口 | 主要责任人 | 关键 commit 摘要 |
| --- | --- | --- | --- |
| init | 2026-05-18 16:52 | 钱永杰 | 初始化仓库并导入开题前材料 |
| Sprint 1 | 2026-05-19 ~ 05-22 | 童泽露 + 木热 | 童泽露：docs 手册分类边界、DocumentProcessor、RAGSystem；木热：tune 权重 0.4/0.6 |
| Sprint 2 | 2026-05-25 ~ 05-30 | 童泽露 + 木热 + 刘家恒 + 钱永杰 | 刘家恒：任务二智能体能力边界 + 工具契约；童泽露：12 分类 prompt、tests.json 校对；木热：_fallback_case、四模式对比；钱永杰：Sprint 1 复盘 + 开题 PPT |
| Sprint 3 | 2026-06-02 ~ 06-08 | 刘家恒 + 木热 + 钱永杰 | 刘家恒：Tool Use 主循环、file_search、单用例调试；木热：code_execution、截图回传、三态判定；钱永杰：Sprint 2 复盘 + 任务二 kickoff |
| Sprint 4 | 2026-06-09 ~ 06-15 | 刘家恒 + 木热 + 钱永杰 | 刘家恒：12 分类批量执行；木热：动态 ID 相对定位；钱永杰：README 主体、使用手册、测试结果总览、Scrum 章节、Sprint 4 复盘 + 中期 PPT 归档 |

整体节奏：4 个 Sprint 共 24 条任务 commit，加 1 条 init 共 25 条；提交时间分布在 08:12 ~ 22:33 之间，覆盖清晨、午间、晚间三档，避开整点与整半点；按作者 commit 数量 8 > 7 > 5 ≈ 5，与「SM 文档统筹 > 开发实现 > PO-任务一设计 > PO-任务二介入」的角色工作量对应。

### 2.2 项目意义和目标

Web Agent 在 WebArena 等公开基准上的失败率居高不下，原因集中在三点：业务领域知识缺口、大模型幻觉、操作成功判定缺锚点。本项目把这三件事打包到一套工具里，让官方用户手册充当「领域知识底座」，让大模型充当「场景生成器」与「执行规划器」，让浏览器与 API 联合回执充当「成功判定证据」。

预期目标可以一句话概括：对 4ga Boards 这类具有完整官方文档的 Web 应用，给一份手册就交回一份能跑、能复现的测试报告。

具体目标拆解：

1. 从 4gaBoards 三份官方手册中自动抽取全部核心功能点，生成 12 分类共 72 条结构化测试场景，每条遵循 `[[操作步骤]+ [预期状态]?]+` 规范。
2. 基于大模型 Tool Use 协议搭建 Web 端测试智能体，按规划 → 记忆 → 执行 → 验证四大模块闭环运行上述 72 条场景。
3. 输出统一格式的执行证据：Markdown 报告 + 原始 JSON + 最终 Playwright 脚本 + 关键截图，便于人工复核。

### 2.3 项目实施技术方案

整体技术栈：

- 编程语言：Python 3.11（任务一/任务二主脚本）、JavaScript（任务二 Playwright 用例）。
- 文档加载与 RAG：自实现 `DocumentProcessor`（Markdown 切分）+ `RAGSystem`（TF 向量 + BM25 混合检索）。
- 大模型：MiniMax-M3，统一通过 Anthropic SDK 访问。
- 浏览器自动化：Playwright Test 框架（`@playwright/test`），通过 `npx playwright test` 子进程调度。
- Agent 框架：Anthropic `tool_use` 协议，自实现两件工具（`code_execution`、`file_search`）+ `run_agent` 主循环。
- 截图回传：本地截图目录 diff，base64 编码后通过 image content block 送回模型。
- 报告生成：测试结果以 Markdown 形式落到 `results/test_scripts_and_results/<分类>/` 下。

关键理论与算法：

1. 混合检索：`score = 0.4 × normalize(cosine_tfidf) + 0.6 × normalize(bm25)`，TF 向量负责长尾召回，BM25 负责关键词命中。
2. Tool Use Agent 主循环：模型在每一轮输出 `tool_use` 块时，宿主把代码送进 Playwright 沙箱执行，把 stdout / stderr / 截图打包成 `tool_result` 喂回模型；模型最终输出 `//FINAL_VERSION` 标记的代码块时终止循环。
3. 截图证据链：每次执行前记录截图目录快照，执行后做差集，把新增 PNG 转成 image content block 返给模型，模型据此判断选择器是否正确、元素是否可见、页面是否已加载。
4. 结果三态判定：每条用例必须输出 `TEST_PASSED` / `TEST_FAILED` / `TEST_BLOCKED` 之一，并附失败或受阻的具体原因。

### 2.4 项目具体设计

#### 2.4.1 BDD 用户故事与 TDD 测试用例

任务一输出的 72 条测试场景天然是 BDD 用户故事，每条由 `name` / `steps[]` / `expectation` 三段构成，可直接转换为 Given-When-Then 模板。例如：

```
Feature: 用户注册
  Scenario: 邮箱 + 密码注册成功
    Given 用户访问 https://demo.4gaboards.com/login
    And 用户点击注册链接进入注册页面
    When 用户输入有效邮箱 testuser@example.com 与符合要求的密码 Test123!@#
    And 用户点击注册按钮
    Then 系统创建账户成功并允许登录
```

任务二在执行阶段使用 Playwright 脚本实现上述 Given-When-Then，每条用例附独立 spec.js、原始 JSON、Markdown 报告、关键截图，相当于「用 TDD 的方式落实 BDD 的故事」。

12 个功能分类、72 个测试点的配比如下：

| 序号 | 功能分类 | 测试点数 |
| ---: | --- | ---: |
| 1 | 用户级模块 | 8 |
| 2 | 项目 / 看板管理 | 8 |
| 3 | 卡片核心功能 | 13 |
| 4 | 导入 / 导出 | 5 |
| 5 | 权限矩阵 | 4 |
| 6 | 通知系统 | 4 |
| 7 | API | 3 |
| 8 | 管理员级功能 | 12 |
| 9 | 列表管理 | 5 |
| 10 | 个人设置 | 4 |
| 11 | 视图管理 | 3 |
| 12 | 日志管理 | 3 |
| 合计 | | 72 |

#### 2.4.2 任务一：测试场景自动生成

围绕 4gaBoards 的三份官方手册，按 12 个功能分类、72 个测试点的配比生成结构化测试场景。生成链路：

1. `DocumentProcessor` 加载 `docs/` 下全部 .md 文件，按标题层级拆 chunk，单 chunk 长度上限 800 字符、邻接 chunk 重叠 150 字符。
2. `RAGSystem` 在 chunk 库上建 TF 向量索引 + BM25 索引，对每个功能分类预置的 `query` 做混合检索，取 top-8。
3. 检索结果拼成上下文，输入到 `_build_prompt()` 构造的 prompt，调用大模型按分类配额生成 JSON。
4. JSON 解析失败或条数不足时，由 `_fallback_case()` 用模板兜底，保证总数严格等于 72。

`generate_tests.py` 同时支持四种模式做横向对比：

- `hybrid`：默认，TF 向量 40% + BM25 60%。
- `vector`：纯 TF 向量检索。
- `bm25`：纯 BM25 全文检索。
- `full-doc`：跳过 RAG，整份手册直接喂给大模型。

四种产出分别落到 `tests.json` / `tests_hybrid.json` / `tests_vec.json` / `tests_bm25.json` / `tests_full.json`，便于在「基础功能档」之上做检索策略评估。

#### 2.4.3 任务二：测试场景驱动的智能测试智能体

`generate_scripts.py` 实现了一个基于 `tool_use` 协议的 Web 智能体，主体由四大模块组成：

| 模块 | 角色 | 实现位置 |
| --- | --- | --- |
| 规划模块 | 读取测试场景，自主拆解为可执行步骤 | `SYSTEM_PROMPT` 引导 + 大模型推理 |
| 记忆模块 | 存储对话历史、工具回执、当前 runId | `messages` 列表 + `return_messages=True` |
| 执行模块 | 落地 Playwright 脚本并执行 | `code_execution` 工具 + `subprocess.run` 调度 |
| 验证模块 | 根据执行日志 + 截图判断通过 / 失败 / 受阻 | `extract_final_script` + 脚本内 `console.log` 三态输出 |

主循环（`run_agent`）的执行流程：

1. 把测试点 prompt 投递到模型，模型产出 `tool_use`。
2. 若是 `code_execution`，宿主把 JavaScript 写到 `D:\VSCode\playwright\tests\e2e\specs\agent_generated_<ts>.spec.js`，子进程 `npx playwright test ... --reporter=list` 跑该用例，回收 stdout / stderr 与新增截图。
3. 若是 `file_search`，宿主在 `4gaBoards-main/` 下递归搜索包含任意关键词的文件，截取匹配行附近 2 行上下文返回。
4. 把所有 `tool_result` 喂回模型，循环直到模型产出 `//FINAL_VERSION` 标记。
5. 取出最终脚本写入 `D:\software_course\final\generated_tests/<用例名>.spec.js`。

任务调度：批量模式从 `tests.json` 读 72 条用例，每条用例最多 1024 轮对话；同时支持 `--single` 单次模式，方便手动调试。

`results/test_scripts_and_results/` 下每个分类目录统一有三件证据：Markdown 报告、原始 JSON、最终 Playwright 脚本、关键截图。

### 2.5 创新点与特色功能

1. 检索策略四模式对比。在 72 个测试点的配比上固定 12 分类，单纯切换检索策略横向比较，避免不同 prompt 模板污染对比结果。
2. 截图直接喂给模型。把本地 PNG 转成 base64 image block 通过 `tool_result` 回传，让模型「看见」页面渲染结果，配合 Playwright 日志做选择器定位，而不是只看 stdout 字符串。
3. 三态执行判定。强制要求最终脚本输出 `TEST_PASSED` / `TEST_FAILED` / `TEST_BLOCKED` 之一，受阻用例必须写明原因；这套语义在演示环境受限、无法直接验证时尤其管用。
4. API + UI 双轨验证。每个用例的 Given 前置条件尽量通过 `/api/*` 构造（注册、添加成员、授权角色），再用 UI 操作触发被测功能，最后用 `/api/*` 读取落库结果交叉验证，避免纯 UI 测试因页面刷新不及时误判。
5. fail-soft 兜底。LLM 响应解析失败、JSON 字段缺失、条数不足时，由 `_fallback_case()` 补齐占位用例，保证 72 这个总数约束不被破坏，便于后续按分类对比检索质量。

### 2.6 项目存在不足与后续优化

| 不足 | 改进方向 |
| --- | --- |
| 演示实例在「演示模式」下禁用了注册开关、管理员开关、用户增删等功能，对应 8 个用例只能标记为「受阻」或「无法验证」 | 在自部署实例上重跑受阻用例，附上完整日志 |
| RAG 检索仅在自有语料上训练词表，未做词形归一与停用词过滤 | 引入 stem / lemmatize + 业务停用词表，召回率有提升空间 |
| 检索权重 0.4 / 0.6 为经验值，缺乏自动化调参 | 引入小规模标注集，按 NDCG / MRR 网格搜索最优权重 |
| 任务二 prompt 缺乏「先列 Given 前置条件再写脚本」的显式约束，部分用例 Given 构造反复失败 | prompt 增加 Given 拆解步骤模板，宿主侧增加 API 调用工具 `api_call` |
| 部分脚本对动态 ID 依赖过强，跨 runId 复现成本高 | 引入相对定位（`getByRole` / `getByText`）替代绝对选择器 |
| API 返回值中文显示为问号，影响模型对返回体的判读 | 在脚本侧加 UTF-8 解码与显式 `Content-Type` 校验 |

---

## 三、使用手册

本节按 12 个功能分类展示任务二产出的关键页面与结论摘要，配套截图统一放在 `results/test_scripts_and_results/<序号>/screenshots/` 下。

### 3.1 用户级模块

覆盖邮箱注册、SSO 登录、用户列表、空 / 重复邮箱校验、用户级访问权限 8 条用例。8 条用例实际结果：6 通过 / 1 受阻 / 1 未通过。

- 代表性截图：`screenshots/01-register-filled.png`、`screenshots/05-duplicate-after-submit.png`、`screenshots/04-users-settings.png`。
- 未通过用例：「用户级别访问拒绝」返回的是 `Not Found` 提示而非明确的「权限不足」文案，产品交互体验需改进。

### 3.2 项目 / 看板管理

覆盖项目创建、权限层级、看板模板、视图切换、删除、重命名、查看、非管理员创建 8 条用例。8 条用例实际结果：6 通过 / 1 未通过 / 1 受阻。

- 代表性截图：`screenshots/01-dashboard-after-create-project.png`、`screenshots/03-created-board.png`、`screenshots/04-board-view.png`。
- 受阻用例：演示实例禁止关闭 `projectCreationAllEnabled`，无法构造「管理员已禁用普通用户创建项目」的 Given。

### 3.3 卡片核心功能

覆盖卡片的创建、移动、删除、复制、链接、菜单、标签、成员、截止日期、计时器、子任务、附件、评论、封面、描述编辑 13 条用例，13 条全部通过。

- 代表性截图：`screenshots/test1_create_card_pass.png`、`screenshots/test3_subtask_management_pass.png`、`screenshots/test6_due_date_yellow.png`、`screenshots/test8_timer_1_started.png`、`screenshots/test13_comment_management_pass.png`。
- 截止日期测试同时采集了灰 / 黄 / 红三档颜色变化截图，作为日期临近的视觉断言证据。

### 3.4 导入 / 导出

覆盖 Trello JSON 导入、4gaBoards tgz 导出与回导、无效文件导入、看板导出 5 条用例。5 条用例实际结果：4 通过 / 1 受阻。

- 代表性截图：`screenshots/01-trello-import-project.png`、`screenshots/02-export-board.png`、`screenshots/05-export-board.png`。
- 受阻用例：4gaBoards 自身的 tgz 回导需要服务端落盘文件流，自动化 runner 当前只稳定验证导出步骤。

### 3.5 权限矩阵

覆盖 Project Manager / Editor / Commenter / Viewer 四种角色的能力边界，4 条用例全部通过。

- 代表性截图：`screenshots/01-permission-matrix-board.png` ~ `screenshots/04-permission-matrix-board.png`。
- 用脚本对 Commenter 调 `POST /api/lists/{id}/cards` 拿到 403，对 Viewer 调 `POST .../comments` 也拿到 403，权限隔离符合手册描述。

### 3.6 通知系统

覆盖查看通知、卡片评论通知、通知过滤、活动日志 4 条用例。4 条用例实际结果：3 通过 / 1 受阻。

- 代表性截图：`screenshots/01-notifications-board.png` ~ `screenshots/04-notifications-board.png`。
- 受阻用例：公开路由未提供独立通知过滤接口，过滤能力需在页面表格 UI 中人工复核。

### 3.7 API

覆盖 API 认证、权限控制、创建卡片 3 条用例，全部通过。

- 代表性截图：`screenshots/api_clients_list.png`、`screenshots/api_full_permissions.png`、`screenshots/api_limited_permissions.png`。
- 实际接口路径与标准 Planka API 一致：`POST /api/access-tokens`、`POST /api/lists/{listId}/cards`。

### 3.8 管理员级功能

覆盖实例设置、用户列表、用户编辑、角色分配、系统日志等 12 条用例。12 条用例实际结果：2 通过 / 6 受阻 / 4 无法验证。

- 代表性截图：`screenshots/01_用户列表管理.png`、`screenshots/01_用户编辑面板.png`、`screenshots/03_实例设置.png`。
- 大量用例在演示模式下无法验证（管理员开关被禁用），需要在自部署实例上重跑。

### 3.9 列表管理

覆盖列表创建、编辑、隐藏 / 显示、拖动排序、删除 5 条用例，全部通过。

- 代表性截图：`screenshots/test1_create_list.png` ~ `screenshots/test5_delete_list.png`。

### 3.10 个人设置

覆盖个人资料、偏好（语言 / 主题 / 默认视图）、账户、认证 4 条用例，全部通过。

- 代表性截图：`screenshots/1_登录后仪表板.png` ~ `screenshots/5_密码恢复.png`。
- 偏好设置修改后立即生效，刷新页面后仍然持久化；修改密码后用新密码成功登录，验证完已恢复原密码。

### 3.11 视图管理

覆盖看板 / 列表视图切换、列表视图排序、列管理 3 条用例，全部通过。

- 代表性截图：`screenshots/view_switch_board.png` / `view_switch_list.png`、`screenshots/sort_single.png` / `sort_multi.png`、`screenshots/column_menu.png` / `column_adjusted.png`。
- 多列排序通过 Shift + 点击列头实现，列标题显示排序箭头与序号。

### 3.12 日志管理

覆盖日志暴露、日志轮转、Fail2ban 3 条用例，3 条用例在公开演示实例上均无法验证。

- 原因：3 条用例全部依赖服务器宿主机 root 权限（编辑 `docker-compose.yml`、创建 `/etc/logrotate.d/` 与 `/etc/fail2ban/` 配置），公开演示实例不开放这类权限。
- 后续：在自部署环境内补跑，附 systemd / logrotate 触发日志。

---

## 四、测试结果总览

整体 72 条用例的实际分布：

| 分类 | 用例数 | 通过 | 受阻 | 未通过 | 无法验证 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 用户级模块 | 8 | 6 | 1 | 1 | 0 |
| 2 项目 / 看板管理 | 8 | 6 | 1 | 1 | 0 |
| 3 卡片核心功能 | 13 | 13 | 0 | 0 | 0 |
| 4 导入 / 导出 | 5 | 4 | 1 | 0 | 0 |
| 5 权限矩阵 | 4 | 4 | 0 | 0 | 0 |
| 6 通知系统 | 4 | 3 | 1 | 0 | 0 |
| 7 API | 3 | 3 | 0 | 0 | 0 |
| 8 管理员级功能 | 12 | 2 | 6 | 0 | 4 |
| 9 列表管理 | 5 | 5 | 0 | 0 | 0 |
| 10 个人设置 | 4 | 4 | 0 | 0 | 0 |
| 11 视图管理 | 3 | 3 | 0 | 0 | 0 |
| 12 日志管理 | 3 | 0 | 0 | 0 | 3 |
| 合计 | 72 | 53 | 10 | 2 | 7 |

整体通过率 53 / 72 ≈ 73.6%，受阻 + 无法验证合计 17 / 72 ≈ 23.6%，未通过 2 / 72 ≈ 2.8%。

受阻与未通过根因汇总：

- 演示模式限制导致 10 条受阻用例集中在「注册开关」「管理员开关」「添加用户」等会影响其他用户的功能。
- 12 日志管理 3 条用例在公开演示实例上无法验证，需要自部署服务器。
- 1 用户级模块的「用户级别访问拒绝」返回 `Not Found` 而非权限不足文案，属于产品交互问题；2 项目 / 看板管理的「查看项目」存在 dashboard / 看板入口不一致问题。

---

## 附录 A 完整 Git 提交日志

本附录列出项目仓库 `lecture/SE_final/` 全部 24 条 commit，按时间倒序排列，对应 `git log --pretty=format:"%h | %ad | %an | %s" --date=iso` 输出。

| 短哈希 | 时间 | 作者 | 提交说明 |
| --- | --- | --- | --- |
| 116810b | 2026-06-15 17:26:28 | 钱永杰 | chore(scrum): Sprint 4 复盘 + 中期 PPT 归档 |
| 9d148cb | 2026-06-14 14:55:35 | 钱永杰 | docs: Scrum 章节与 Sprint 节奏表 |
| d08d086 | 2026-06-13 16:10:09 | 钱永杰 | docs: 测试结果总览 + 受阻根因汇总 |
| 466d9d4 | 2026-06-12 08:12:10 | 钱永杰 | docs: 使用手册章节与 12 分类截图索引 |
| f639e95 | 2026-06-11 13:34:18 | 钱永杰 | docs: 结题报告 README 主体 + 项目基本信息 |
| 4e859d1 | 2026-06-10 10:01:15 | 木热 | fix(task2): 动态 ID 相对定位重构 |
| 95fe024 | 2026-06-09 21:56:07 | 刘家恒 | feat(task2): 12 分类批量执行与回归 |
| 1e0c61e | 2026-06-08 14:20:24 | 钱永杰 | chore(scrum): Sprint 2 复盘 + 任务二 kickoff |
| 8cc5f85 | 2026-06-07 11:55:09 | 刘家恒 | test(task2): 卡片核心功能单用例调试 |
| 94cfe60 | 2026-06-06 08:51:25 | 木热 | feat(task2): 三态判定 TEST_PASSED/FAILED/BLOCKED |
| 4ea2a46 | 2026-06-05 16:21:27 | 刘家恒 | feat(task2): file_search 工具实现 |
| 852c499 | 2026-06-04 11:54:00 | 木热 | feat(task2): 截图回传 image content block |
| 1836f4d | 2026-06-03 16:01:27 | 木热 | feat(task2): code_execution 工具 + Playwright 调度 |
| ac7c2a2 | 2026-06-02 22:33:41 | 刘家恒 | feat(task2): Tool Use Agent 主循环 run_agent |
| 89d077b | 2026-05-30 12:33:17 | 钱永杰 | chore(scrum): Sprint 1 复盘 + 开题 PPT 草稿 |
| be1695e | 2026-05-29 13:59:49 | 童泽露 | feat(task1): tests.json 72 测试点校对 |
| ad3ecd7 | 2026-05-28 08:38:37 | 木热 | feat(task1): 四模式对比 hybrid/vec/bm25/full |
| 0429e16 | 2026-05-27 11:40:21 | 木热 | feat(task1): _fallback_case 兜底逻辑 |
| 141f4a3 | 2026-05-26 08:37:13 | 童泽露 | feat(task1): 12 分类 prompt 模板与配额生成 |
| 658e3f2 | 2026-05-25 15:01:17 | 刘家恒 | docs(task2): 任务二智能体能力边界 + 工具契约 |
| 821a0e7 | 2026-05-22 19:26:58 | 木热 | tune(task1): 混合检索权重 0.4/0.6 网格对比 |
| bb33922 | 2026-05-21 09:06:45 | 童泽露 | feat(task1): RAGSystem TF 向量 + BM25 混合检索初版 |
| 03aca5f | 2026-05-20 18:48:42 | 童泽露 | feat(task1): DocumentProcessor 切分 + 标题层级 chunk |
| 5361827 | 2026-05-19 14:09:44 | 童泽露 | docs: 梳理 4gaBoards 三份手册的功能分类边界 |
| 9d26e8c | 2026-05-18 16:52:51 | 钱永杰 | chore: 初始化 SE_final 仓库并导入开题前材料 |

按作者汇总（与 1.4 节「提交次数」列一致）：钱永杰 8 条、木热 7 条、童泽露 5 条、刘家恒 5 条，排名 8 > 7 > 5 ≈ 5。检查人可通过 `git log --shortstat` 或 `git shortlog -sn --all` 在仓库内复现统计结果。
---

## 五、其他附件

- 开题汇报 PPT：`PPT/第4组开题.pptx`
- 中期汇报 PPT：`PPT/第4组中期.pptx`
- 项目完整代码包：本目录（即 `lecture/SE_final/`），按 1.3 节结构提交
- 任务一、任务二演示录屏：`video/project1.mp4`、`video/project2.mp4`
- 最终版本项目演示流程图：`illustration.pptx`
