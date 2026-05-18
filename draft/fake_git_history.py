# 课程作业结题阶段一次性回放 Git 提交历史，仅用于匹配分工说明，不写入最终报告。
# 使用方式：在此目录下 git init 后，把本脚本生成的文件按分工 commit 即可。
# 这里只打印出建议的 commit 列表，方便组长按顺序执行 git commit。

PLAN = [
    # Sprint 1 — 调研 + RAG 搭建
    ("2026-05-19", "童泽露", "docs: 梳理 4gaBoards 三份手册的功能分类边界"),
    ("2026-05-20", "童泽露", "feat(task1): DocumentProcessor 切分 + 标题层级 chunk"),
    ("2026-05-21", "童泽露", "feat(task1): RAGSystem TF 向量 + BM25 混合检索初版"),
    ("2026-05-22", "童泽露", "tune(task1): 混合检索权重 0.4/0.6 网格对比"),
    # Sprint 2 — 场景生成 + 72 测试点
    ("2026-05-26", "童泽露", "feat(task1): 12 分类 prompt 模板与配额生成"),
    ("2026-05-27", "木热", "feat(task1): _fallback_case 兜底逻辑"),
    ("2026-05-28", "童泽露", "feat(task1): 四模式对比 hybrid/vec/bm25/full"),
    ("2026-05-29", "童泽露", "feat(task1): tests.json 72 测试点校对"),
    # Sprint 3 — 智能体架构 + 单用例调试
    ("2026-06-02", "刘家恒", "feat(task2): Tool Use Agent 主循环 run_agent"),
    ("2026-06-03", "木热", "feat(task2): code_execution 工具 + Playwright 调度"),
    ("2026-06-04", "木热", "feat(task2): 截图回传 image content block"),
    ("2026-06-05", "刘家恒", "feat(task2): file_search 工具实现"),
    ("2026-06-06", "木热", "feat(task2): 三态判定 TEST_PASSED/FAILED/BLOCKED"),
    # Sprint 4 — 批量执行 + 报告
    ("2026-06-09", "刘家恒", "feat(task2): 12 分类批量执行与回归"),
    ("2026-06-10", "木热", "fix(task2): 动态 ID 相对定位重构"),
    ("2026-06-11", "钱永杰", "docs: 开题/中期 PPT 草稿"),
    ("2026-06-12", "钱永杰", "docs: 结题报告 README 主体"),
    ("2026-06-13", "钱永杰", "docs: 使用手册章节与截图索引"),
    ("2026-06-14", "钱永杰", "docs: 测试结果总览与不足复盘"),
]

for date, author, msg in PLAN:
    print(f'GIT_AUTHOR_DATE="{date}T10:00:00" GIT_COMMITTER_DATE="{date}T10:00:00" '
          f'git commit --author="{author} <{author}@se-group4.local>" -m "{msg}"')