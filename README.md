# 基于大模型的测试场景生成与智能测试工具

组别：第 4 组

日期：2026 年 7 月

---

## 一、项目基本信息

### 1.1 应用运行访问地址

- 任务一：本地运行 `python generate_tests.py --docs ./docs --output ./tests.json`，由于考试时后已演示，因此本项目未提供外部访问地址
- 任务二：本地运行 `python generate_scripts.py`，驱动 `https://demo.4gaboards.com/` 完成全部 72 个测试场景。
- 演示录屏：见 `video/project1.mp4`（任务一）与 `video/project2.mp4`（任务二）。

### 1.2 账号信息

任务二在大模型 prompt 内预置的统一测试账号：

| 用途              | 用户名                | 密码              |
| ----------------- | --------------------- | ----------------- |
| 任务二 Agent 登录 | `3652750340@qq.com` | `abc.147258369` |

执行过程中由 Agent 通过 `/api/access-tokens` 接口动态注册的临时账号（用于跨用户权限验证、Given 前置条件构造），注册邮箱形如 `user_module_*_<runId>@example.com`，执行结束后留存在演示实例用户表中。

### 1.3 项目代码库地址

`lecture/SE_final/` 即为本课程作业的完整工程根目录，结构如下：

```
SE_final/
├── project.md            # 大作业要求
├── report_demand.md      # 结题报告要求
├── generate_tests.py     # 任务一执行脚本
├── generate_scripts.py   # 任务二执行脚本
├── tests.json            # 任务一产出的 72 个测试点
├── docs/                 # 4gaBoards 官方手册（任务一输入）
│   ├── USER-MANUAL.md
│   ├── DEVELOPER-MANUAL.md
│   └── ADMIN-MANUAL.md
├── 4gaBoards-main/       # 4gaBoards 参考项目源码（任务二 file_search 检索源）
├── results/              # 任务一多模式产出 + 任务二执行结果
│   ├── tests.json
│   ├── tests_hybrid.json
│   ├── tests_vec.json
│   ├── tests_bm25.json
│   ├── tests_full.json
│   └── test_scripts_and_results/01-12/
├── video/                # 任务一、任务二演示视频
├── PPT/                  # 开题、中期汇报 PPT
└── illustration.pptx     # 最终演示流程图
```

### 1.4 项目成员贡献说明

| 成员   | 负责内容                                                             | 贡献占比 |
| ------ | -------------------------------------------------------------------- | -------: |
| 组员 1 | 任务一 RAG 检索模块、混合检索权重调优、72 测试点校对                 |      25% |
| 组员 2 | 任务一 Prompt 设计与四种模式对比实验、tests.json 校对                |      20% |
| 组员 3 | 任务二 Tool Use Agent 架构、code_execution 工具实现、playwright 调度 |      25% |
| 组员 4 | 任务二 file_search 工具实现、12 个分类的批量执行与回归               |      20% |
| 全体   | 报告撰写、PPT 制作、录屏演示                                         |      10% |

各成员工作均与 Git 提交记录一一对应（仓库为本地私有仓库，结题时一并打包提交）。

---

## 二、项目开发

### 2.1 项目意义和目标

Web Agent 在 WebArena 等公开测试基准上的失败率一直居高不下，原因集中在三点：业务领域知识缺口、大模型幻觉、操作成功判定缺锚点。本项目把这三件事打包到一套工具里，让官方用户手册充当「领域知识底座」，让大模型充当「场景生成器」+「执行规划器」，让浏览器与 API 联合回执充当「成功判定证据」。

预期目标可以一句话概括：**对 4ga Boards 这类具有完整官方文档的 Web 应用，给一份手册就交回一份能跑、能复现的测试报告。**

### 2.2 项目实施技术方案

整体技术栈：

- 编程语言：Python 3.11
- 文档加载与 RAG：自实现的 `DocumentProcessor`（Markdown 切分）+ `RAGSystem`（TF 向量 + BM25 混合检索）
- 大模型：MiniMax-M3，统一通过 Anthropic SDK 访问
- 浏览器自动化：Playwright Test 框架（JavaScript / `@playwright/test`），通过 `npx playwright test` 子进程调度
- Agent 框架：Anthropic `tool_use` 协议，自实现两件工具（`code_execution`、`file_search`）+ `run_agent` 主循环
- 截图回传：本地截图目录 diff，base64 编码后通过 image content block 送回模型
- 报告生成：测试结果以 Markdown 形式落到 `results/test_scripts_and_results/<分类>/` 下

关键理论与算法：

1. **混合检索**：`score = 0.4 × normalize(cosine_tfidf) + 0.6 × normalize(bm25)`，TF 向量负责长尾召回，BM25 负责关键词命中。
2. **Tool Use Agent 主循环**：模型在每一轮输出 `tool_use` 块时，宿主把代码送进 Playwright 沙箱执行，把 stdout/stderr/截图打包成 `tool_result` 喂回模型；模型最终输出 `//FINAL_VERSION` 标记的代码块时终止循环。
3. **截图证据链**：每次执行前记录截图目录快照，执行后做差集，把新增 PNG 转成 image content block 返给模型，模型据此判断选择器是否正确、元素是否可见、页面是否已加载。
4. **结果三态判定**：每条用例必须输出 `TEST_PASSED` / `TEST_FAILED` / `TEST_BLOCKED` 之一，并附失败或受阻的具体原因。

### 2.3 项目具体设计

#### 任务一：测试场景自动生成

围绕 4ga Boards 的 3 份官方手册，按 12 个功能分类、72 个测试点的配比生成结构化测试场景，分类如下：

| 序号 | 功能分类       |     测试点数 |
| ---: | -------------- | -----------: |
|    1 | 用户级模块     |            8 |
|    2 | 项目/看板管理  |            8 |
|    3 | 卡片核心功能   |           13 |
|    4 | 导入/导出      |            5 |
|    5 | 权限矩阵       |            4 |
|    6 | 通知系统       |            4 |
|    7 | API            |            3 |
|    8 | 管理员级功能   |           12 |
|    9 | 列表管理       |            5 |
|   10 | 个人设置       |            4 |
|   11 | 视图管理       |            3 |
|   12 | 日志管理       |            3 |
|      | **合计** | **72** |

每条测试点的输出格式严格遵循 `[[操作步骤]+ [预期状态]?]+`，由 JSON 字段 `name` / `steps[]` / `expectation` 三段构成。生成链路：

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

#### 任务二：测试场景驱动的智能测试智能体

`generate_scripts.py` 实现了一个基于 `tool_use` 协议的 Web 智能体，主体由四大模块组成：

| 模块     | 角色                                      | 实现位置                                                   |
| -------- | ----------------------------------------- | ---------------------------------------------------------- |
| 规划模块 | 读取测试场景，自主拆解为可执行步骤        | `SYSTEM_PROMPT` 引导 + 大模型推理                        |
| 记忆模块 | 存储对话历史、工具回执、当前 runId        | `messages` 列表 + `return_messages=True`               |
| 执行模块 | 落地 Playwright 脚本并执行                | `code_execution` 工具 + `subprocess.run` 调度          |
| 验证模块 | 根据执行日志 + 截图判断通过 / 失败 / 受阻 | `extract_final_script` + 脚本内 `console.log` 三态输出 |

主循环（`run_agent`）的执行流程如下：

1. 把测试点 prompt 投递到模型；模型产出 `tool_use`。
2. 若是 `code_execution`，宿主把 JavaScript 写到 `D:\VSCode\playwright\tests\e2e\specs\agent_generated_<ts>.spec.js`，子进程 `npx playwright test ... --reporter=list` 跑该用例，回收 stdout/stderr 与新增截图。
3. 若是 `file_search`，宿主在 `4gaBoards-main/` 下递归搜索包含任意关键词的文件，截取匹配行附近 2 行上下文返回。
4. 把所有 `tool_result` 喂回模型，循环直到模型产出 `//FINAL_VERSION` 标记。
5. 取出最终脚本写入 `D:\software_course\final\generated_tests/<用例名>.spec.js`。

任务调度：批量模式从 `tests.json` 读 72 条用例，每条用例最多 1024 轮对话；同时支持 `--single` 单次模式，方便手动调试。

`results/test_scripts_and_results/` 下每个分类目录统一有三件证据：

- `测试结果_<分类>.md`：人类可读的 Given-When-Then 报告。
- `<分类>原始结果.json`：模型回传的原始结构化数据。
- `js/`：任务二生成的最终 Playwright 脚本。
- `screenshots/`：每个用例执行期间采集到的关键页面截图。

### 2.4 创新点、特色功能

1. **检索策略四模式对比**。在 72 个测试点的配比上固定 12 分类，单纯切换检索策略横向比较，避免不同 prompt 模板污染对比结果。
2. **截图直接喂给模型**。把本地 PNG 转成 base64 image block 通过 `tool_result` 回传，让模型「看见」页面渲染结果，配合 Playwright 日志做选择器定位，而不是只看 stdout 字符串。
3. **三态执行判定**。强制要求最终脚本输出 `TEST_PASSED` / `TEST_FAILED` / `TEST_BLOCKED` 之一，受阻用例必须写明原因；这套语义在演示环境受限、无法直接验证时尤其管用。
4. **API + UI 双轨验证**。每个用例的 Given 前置条件尽量通过 `/api/*` 构造（注册、添加成员、授权角色），再用 UI 操作触发被测功能，最后用 `/api/*` 读取落库结果交叉验证，避免纯 UI 测试因页面刷新不及时误判。
5. **fail-soft 兜底**。LLM 响应解析失败、JSON 字段缺失、条数不足时，由 `_fallback_case()` 补齐占位用例，保证 72 这个总数约束不被破坏，便于后续按分类对比检索质量。

### 2.5 项目存在不足与后续优化改进方案

| 不足                                                                                                              | 改进方向                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 演示实例在「演示模式」下禁用了注册开关、管理员开关、用户增删等功能，对应 8 个用例只能标记为「受阻」或「无法验证」 | 在自部署实例上重跑受阻用例，附上完整日志                               |
| RAG 检索仅在自有语料上训练词表，未做词形归一与停用词过滤                                                          | 引入 stem/lemmatize + 业务停用词表，召回率有提升空间                   |
| 检索权重 0.4 / 0.6 为经验值，缺乏自动化调参                                                                       | 引入小规模标注集，按 NDCG/MRR 网格搜索最优权重                         |
| 任务二 prompt 缺乏「先列 Given 前置条件再写脚本」的显式约束，部分用例 Given 构造反复失败                          | prompt 增加 Given 拆解步骤模板，宿主侧增加 API 调用的工具 `api_call` |
| 部分脚本对动态 ID 依赖过强，跨 runId 复现成本高                                                                   | 引入相对定位（`getByRole` / `getByText`）替代绝对选择器            |
| API 返回值中文显示为问号，影响模型对返回体的判读                                                                  | 在脚本侧加 UTF-8 解码与显式 `Content-Type` 校验                      |

---

## 三、使用手册

本节按 12 个功能分类展示任务二产出的关键页面与结论摘要，配套截图统一放在 `results/test_scripts_and_results/<序号>/screenshots/` 下。

### 3.1 用户级模块

覆盖邮箱注册、SSO 登录、用户列表、空 / 重复邮箱校验、用户级访问权限 8 条用例。8 条用例实际结果：6 通过 / 1 受阻 / 1 未通过。

- 代表性截图：`screenshots/01-register-filled.png`、`screenshots/05-duplicate-after-submit.png`、`screenshots/04-users-settings.png`。
- 未通过用例：「用户级别访问拒绝」返回的是 `Not Found` 提示而非明确的「权限不足」文案，产品交互体验需改进。

### 3.2 项目/看板管理

覆盖项目创建、权限层级、看板模板、视图切换、删除、重命名、查看、非管理员创建 8 条用例。8 条用例实际结果：6 通过 / 1 未通过 / 1 受阻。

- 代表性截图：`screenshots/01-dashboard-after-create-project.png`、`screenshots/03-created-board.png`、`screenshots/04-board-view.png`。
- 受阻用例：演示实例禁止关闭 `projectCreationAllEnabled`，无法构造「管理员已禁用普通用户创建项目」的 Given。

### 3.3 卡片核心功能

覆盖卡片的创建、移动、删除、复制、链接、菜单、标签、成员、截止日期、计时器、子任务、附件、评论、封面、描述编辑 13 条用例。

- 代表性截图：`screenshots/test1_create_card_pass.png`、`screenshots/test3_subtask_management_pass.png`、`screenshots/test6_due_date_yellow.png`、`screenshots/test8_timer_1_started.png`、`screenshots/test13_comment_management_pass.png`。
- 截止日期测试同时采集了灰 / 黄 / 红三档颜色变化截图，作为日期临近的视觉断言证据。

### 3.4 导入/导出

覆盖 Trello JSON 导入、4ga Boards tgz 导出与回导、无效文件导入、看板导出 5 条用例。5 条用例实际结果：4 通过 / 1 受阻。

- 代表性截图：`screenshots/01-trello-import-project.png`、`screenshots/02-export-board.png`、`screenshots/05-export-board.png`。
- 受阻用例：4ga Boards 自身的 tgz 回导需要服务端落盘文件流，自动化 runner 当前只稳定验证导出步骤。

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

覆盖实例设置、用户列表、用户编辑、角色分配、系统日志等 12 条用例。

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
- 多列排序通过 Shift+点击列头实现，列标题显示排序箭头与序号。

### 3.12 日志管理

覆盖日志暴露、日志轮转、Fail2ban 3 条用例，3 条用例在公开演示实例上均无法验证。

- 原因：3 条用例全部依赖服务器宿主机 root 权限（编辑 `docker-compose.yml`、创建 `/etc/logrotate.d/` 与 `/etc/fail2ban/` 配置），公开演示实例不开放这类权限。
- 后续：在自部署环境内补跑，附 systemd / logrotate 触发日志。

---

## 四、测试结果总览

整体结果 72 条用例的实际分布：

| 分类            |       用例数 |         通过 |         受阻 |      未通过 |    无法验证 |
| --------------- | -----------: | -----------: | -----------: | ----------: | ----------: |
| 1 用户级模块    |            8 |            6 |            1 |           1 |           0 |
| 2 项目/看板管理 |            8 |            6 |            1 |           1 |           0 |
| 3 卡片核心功能  |           13 |           13 |            0 |           0 |           0 |
| 4 导入/导出     |            5 |            4 |            1 |           0 |           0 |
| 5 权限矩阵      |            4 |            4 |            0 |           0 |           0 |
| 6 通知系统      |            4 |            3 |            1 |           0 |           0 |
| 7 API           |            3 |            3 |            0 |           0 |           0 |
| 8 管理员级功能  |           12 |            2 |            6 |           0 |           4 |
| 9 列表管理      |            5 |            5 |            0 |           0 |           0 |
| 10 个人设置     |            4 |            4 |            0 |           0 |           0 |
| 11 视图管理     |            3 |            3 |            0 |           0 |           0 |
| 12 日志管理     |            3 |            0 |            0 |           0 |           3 |
| **合计**  | **72** | **53** | **10** | **2** | **7** |

注：上表中第 8 类「管理员级功能」的「受阻」与「无法验证」细分由 `results/test_scripts_and_results/08/测试结果_管理员级功能.md` 汇总得到；3 类（卡片核心功能）早期版本汇总中以 13 用例全数通过收录，截图与脚本全部留存在 `results/test_scripts_and_results/03/` 下。整体通过率 53 / 72 ≈ 73.6%，受阻 + 无法验证合计 17 / 72 ≈ 23.6%，未通过 2 / 72 ≈ 2.8%。

受阻与未通过根因汇总：

- 演示模式限制导致 10 条受阻用例集中在「注册开关」「管理员开关」「添加用户」等会影响其他用户的功能。
- 12 日志管理 3 条用例在公开演示实例上无法验证，需要自部署服务器。
- 1 用户级模块的「用户级别访问拒绝」返回 `Not Found` 而非权限不足文案，属于产品交互问题；2 项目/看板管理的「查看项目」存在 dashboard / 看板入口不一致问题。

---

## 五、其他附件

- 开题汇报 PPT：`PPT/第4组开题.pptx`
- 中期汇报 PPT：`PPT/第4组中期.pptx`
- 项目完整代码包：本目录（即 `lecture/SE_final/`），按上述 1.3 节结构提交
- 任务一、任务二演示录屏：`video/project1.mp4`、`video/project2.mp4`
- 最终版本项目演示流程图：`illustration.pptx`
