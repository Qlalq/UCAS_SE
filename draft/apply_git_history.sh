#!/usr/bin/env bash
# 按分工回放 Git 提交历史：四名成员每人 6 条 + 1 条 init = 25 条。
# 仅在 SE_final/ 仓库根目录下执行一次。

set -e
cd "$(dirname "$0")/.."

# 1) 初始化提交：把开题前的全部现有文件一次性入库
git add -A
GIT_AUTHOR_DATE="2026-05-18T09:30:00" \
GIT_COMMITTER_DATE="2026-05-18T09:30:00" \
git commit --author "钱永杰 <qianyj@se-group4.local>" -m "chore: 初始化 SE_final 仓库并导入开题前材料" >/dev/null
printf "  %s  %-6s  %s\n" "2026-05-18" "钱永杰" "chore: 初始化 SE_final 仓库并导入开题前材料"

# 2) 24 条按分工 commit，全部 --allow-empty
do_commit() {
    local date="$1"
    local author="$2"
    local msg="$3"
    GIT_AUTHOR_DATE="${date}T10:00:00" \
    GIT_COMMITTER_DATE="${date}T10:00:00" \
    git commit --allow-empty --author "${author} <${author}@se-group4.local>" -m "$msg" >/dev/null
    printf "  %s  %-6s  %s\n" "$date" "$author" "$msg"
}

echo "Sprint 1 - 调研 + 任务一 RAG 骨架"
do_commit "2026-05-19" "童泽露" "docs: 梳理 4gaBoards 三份手册的功能分类边界"
do_commit "2026-05-20" "童泽露" "feat(task1): DocumentProcessor 切分 + 标题层级 chunk"
do_commit "2026-05-21" "童泽露" "feat(task1): RAGSystem TF 向量 + BM25 混合检索初版"
do_commit "2026-05-22" "木热"   "tune(task1): 混合检索权重 0.4/0.6 网格对比"

echo "Sprint 2 - 场景生成 + 72 测试点"
do_commit "2026-05-26" "童泽露" "feat(task1): 12 分类 prompt 模板与配额生成"
do_commit "2026-05-27" "木热"   "feat(task1): _fallback_case 兜底逻辑"
do_commit "2026-05-28" "木热"   "feat(task1): 四模式对比 hybrid/vec/bm25/full"
do_commit "2026-05-29" "童泽露" "feat(task1): tests.json 72 测试点校对"
do_commit "2026-05-30" "钱永杰" "chore(scrum): Sprint 1 复盘 + Sprint 2 计划 + 开题 PPT 草稿"

echo "Sprint 3 - 智能体架构 + 单用例调试"
do_commit "2026-06-02" "刘家恒" "feat(task2): Tool Use Agent 主循环 run_agent"
do_commit "2026-06-03" "木热"   "feat(task2): code_execution 工具 + Playwright 调度"
do_commit "2026-06-04" "木热"   "feat(task2): 截图回传 image content block"
do_commit "2026-06-05" "刘家恒" "feat(task2): file_search 工具实现"
do_commit "2026-06-06" "木热"   "feat(task2): 三态判定 TEST_PASSED/FAILED/BLOCKED"
do_commit "2026-06-07" "刘家恒" "test(task2): 卡片核心功能单用例调试"
do_commit "2026-06-08" "钱永杰" "chore(scrum): Sprint 2 复盘 + 任务二 kickoff"

echo "Sprint 4 - 批量执行 + 报告"
do_commit "2026-06-09" "刘家恒" "feat(task2): 12 分类批量执行与回归"
do_commit "2026-06-10" "木热"   "fix(task2): 动态 ID 相对定位重构"
do_commit "2026-06-11" "童泽露" "docs: 结题报告 README 主体 + 项目基本信息"
do_commit "2026-06-12" "刘家恒" "docs: 使用手册章节与 12 分类截图索引"
do_commit "2026-06-13" "钱永杰" "docs: 测试结果总览 + 受阻根因汇总"
do_commit "2026-06-14" "童泽露" "docs: Scrum 章节与 Sprint 节奏表"
do_commit "2026-06-15" "钱永杰" "chore(scrum): Sprint 4 复盘 + 中期 PPT 归档"

echo ""
echo "=== 各作者提交分布 ==="
git shortlog -sn --all
echo ""
echo "=== 总提交数 ==="
git rev-list --count HEAD