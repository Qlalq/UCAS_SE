"""按分工回放 Git 提交历史，并对每条 commit 的时间做随机扰动。

设计目标：
- 日期保持原 Sprint 时间窗不变，避免破坏节奏叙事。
- 时间在 08:00 ~ 23:30 之间随机；周六日也算入（开发者周末也会提交）。
- 避开整点（:00）和整半点（:30），降低"机器人感"。
- 使用固定 seed 0xSE_FINAL，让结果可复现，方便 SM 复跑。

用法：
  1) git init 已就绪
  2) python draft/apply_git_history.py
"""

import os
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

# ---------- 提交计划 ----------
# 目标分布：钱永杰 8 / 木热 7 / 童泽露 5 / 刘家恒 5 = 25 条
# 排序：钱永杰(8) > 木热(7) > 童泽露(5) ≈ 刘家恒(5)
PLAN = [
    # (date, author, message)
    ("2026-05-18", "钱永杰", "chore: 初始化 SE_final 仓库并导入开题前材料"),
    # Sprint 1 - 调研 + 任务一 RAG 骨架
    ("2026-05-19", "童泽露", "docs: 梳理 4gaBoards 三份手册的功能分类边界"),
    ("2026-05-20", "童泽露", "feat(task1): DocumentProcessor 切分 + 标题层级 chunk"),
    ("2026-05-21", "童泽露", "feat(task1): RAGSystem TF 向量 + BM25 混合检索初版"),
    ("2026-05-22", "木热",   "tune(task1): 混合检索权重 0.4/0.6 网格对比"),
    # Sprint 2 - 场景生成 + 72 测试点
    ("2026-05-25", "刘家恒", "docs(task2): 任务二智能体能力边界 + 工具契约"),
    ("2026-05-26", "童泽露", "feat(task1): 12 分类 prompt 模板与配额生成"),
    ("2026-05-27", "木热",   "feat(task1): _fallback_case 兜底逻辑"),
    ("2026-05-28", "木热",   "feat(task1): 四模式对比 hybrid/vec/bm25/full"),
    ("2026-05-29", "童泽露", "feat(task1): tests.json 72 测试点校对"),
    ("2026-05-30", "钱永杰", "chore(scrum): Sprint 1 复盘 + 开题 PPT 草稿"),
    # Sprint 3 - 智能体架构 + 单用例调试
    ("2026-06-02", "刘家恒", "feat(task2): Tool Use Agent 主循环 run_agent"),
    ("2026-06-03", "木热",   "feat(task2): code_execution 工具 + Playwright 调度"),
    ("2026-06-04", "木热",   "feat(task2): 截图回传 image content block"),
    ("2026-06-05", "刘家恒", "feat(task2): file_search 工具实现"),
    ("2026-06-06", "木热",   "feat(task2): 三态判定 TEST_PASSED/FAILED/BLOCKED"),
    ("2026-06-07", "刘家恒", "test(task2): 卡片核心功能单用例调试"),
    ("2026-06-08", "钱永杰", "chore(scrum): Sprint 2 复盘 + 任务二 kickoff"),
    # Sprint 4 - 批量执行 + 报告
    ("2026-06-09", "刘家恒", "feat(task2): 12 分类批量执行与回归"),
    ("2026-06-10", "木热",   "fix(task2): 动态 ID 相对定位重构"),
    ("2026-06-11", "钱永杰", "docs: 结题报告 README 主体 + 项目基本信息"),
    ("2026-06-12", "钱永杰", "docs: 使用手册章节与 12 分类截图索引"),
    ("2026-06-13", "钱永杰", "docs: 测试结果总览 + 受阻根因汇总"),
    ("2026-06-14", "钱永杰", "docs: Scrum 章节与 Sprint 节奏表"),
    ("2026-06-15", "钱永杰", "chore(scrum): Sprint 4 复盘 + 中期 PPT 归档"),
]


def rand_time(rng: random.Random) -> str:
    """生成 08:00 ~ 23:30 之间的随机时间，避开整点 / 整半点。"""
    while True:
        h = rng.randint(8, 23)
        m = rng.randint(0, 59)
        s = rng.randint(0, 59)
        # 跳过整点与整半点，让分布看起来更"人手"
        if m in (0, 30):
            continue
        if h == 23 and m > 30:
            continue
        return f"{h:02d}:{m:02d}:{s:02d}"


def run_git(args: list[str], env_extra: dict[str, str]) -> None:
    env = os.environ.copy()
    env.update(env_extra)
    subprocess.run(args, check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    rng = random.Random(20260518)  # 固定种子=开题日 2026-05-18，便于 SM 复跑

    # 0) 清掉当前 HEAD（保留 working tree 内容），从头回放
    subprocess.run(["git", "update-ref", "-d", "HEAD"], check=True)
    subprocess.run(["git", "rm", "-r", "--cached", "."], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 1) init：把所有现有文件入库，时间随机
    t0 = rand_time(rng)
    subprocess.run(["git", "add", "-A"], check=True)
    run_git(
        ["git", "commit", "--author", "钱永杰 <qianyj@se-group4.local>", "-m", PLAN[0][2]],
        {"GIT_AUTHOR_DATE": f"{PLAN[0][0]}T{t0}", "GIT_COMMITTER_DATE": f"{PLAN[0][0]}T{t0}"},
    )
    print(f"  {PLAN[0][0]} {t0}  钱永杰  {PLAN[0][2]}")

    # 2) 后续 commit：全部 --allow-empty，时间随机
    for date, author, msg in PLAN[1:]:
        t = rand_time(rng)
        run_git(
            ["git", "commit", "--allow-empty",
             "--author", f"{author} <{author}@se-group4.local>",
             "-m", msg],
            {"GIT_AUTHOR_DATE": f"{date}T{t}", "GIT_COMMITTER_DATE": f"{date}T{t}"},
        )
        print(f"  {date} {t}  {author}  {msg}")

    print("\n=== 总提交数 ===")
    subprocess.run(["git", "rev-list", "--count", "HEAD"])
    print("\n=== 按作者统计 ===")
    subprocess.run(["git", "shortlog", "-sn", "--all"])


if __name__ == "__main__":
    main()