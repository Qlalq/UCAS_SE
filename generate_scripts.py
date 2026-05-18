# -*- coding: utf-8 -*-
"""
MiniMax Tool Use Agent
- 工具1: code_execution — 执行 Playwright 脚本，返还执行日志和截图
- 工具2: file_search   — 支持多个关键词，在指定目录递归搜索包含任一关键词的文件
支持截图通过 image content block 返还给模型
"""

import os
import sys
import json
import re
import glob
import base64
import subprocess
import tempfile
import anthropic

# ── 配置 ──
BASE_URL = "https://api.minimaxi.com/anthropic"
API_KEY = ""
MODEL = "MiniMax-M3"
SEARCH_ROOT = r"D:\software_course\final\4gaBoards-main"
SCREENSHOT_DIR = r"D:\software_course\final\screenshots"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# ── 初始化客户端 ──
client = anthropic.Anthropic(base_url=BASE_URL, api_key=API_KEY)

# ── 工具定义 ──
TOOLS = [
    {
        "name": "code_execution",
        "description": (
            "执行一段 Playwright 测试脚本（JavaScript / @playwright/test），"
            "并返回执行结果和截图。截图会自动保存到指定目录，并作为图片返还给你。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "要执行的 JavaScript 代码字符串（Playwright Test 脚本）"
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "file_search",
        "description": (
            "在指定项目目录中递归搜索包含任意关键词的文件，"
            "返回匹配文件的路径和内容摘要。只要文件内容包含其中一个关键词即视为匹配。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "关键词列表，文件内容包含其中任意一个即匹配"
                }
            },
            "required": ["keywords"]
        }
    }
]


# ──────────────────────────────────────────────
# 截图相关工具函数
# ──────────────────────────────────────────────

def get_existing_screenshots():
    if not os.path.isdir(SCREENSHOT_DIR):
        return set()
    return set(glob.glob(os.path.join(SCREENSHOT_DIR, "*.png")))


def collect_new_screenshots(before_set):
    after_set = get_existing_screenshots()
    return sorted(after_set - before_set)


def image_to_content_block(img_path):
    with open(img_path, "rb") as f:
        b64_data = base64.b64encode(f.read()).decode("utf-8")
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": b64_data,
        },
    }


# ──────────────────────────────────────────────
# 工具执行函数
# ──────────────────────────────────────────────

def execute_code(code):
    import shutil
    import os

    # 检查 npx 是否在 PATH 中
    #npx_path = shutil.which("npx")
    #node_path = shutil.which("node")
    #print("DEBUG - npx path:", npx_path)
    #print("DEBUG - node path:", node_path)
    #print("DEBUG - PATH (前500字符):", os.environ.get("PATH", "")[:500])


    before_screenshots = get_existing_screenshots()

    # 写到 Playwright 的 testDir 中，而不是系统临时目录
    test_dir = r"D:\VSCode\playwright\tests\e2e\specs"
    os.makedirs(test_dir, exist_ok=True)

    # 用有意义的文件名，方便调试
    import time
    tmp_path = os.path.join(test_dir, "agent_generated_{}.spec.js".format(int(time.time())))

    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(code)

    #print("DEBUG - tmp_path:", tmp_path)
    #print("DEBUG - file exists:", os.path.exists(tmp_path))

    try:
        result = subprocess.run(
            ["npx", "playwright", "test", os.path.basename(tmp_path), "--reporter=list"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=r"D:\VSCode\playwright\tests",  # ← playwright.config.ts 所在目录
            env=os.environ.copy(),
            shell=True,
            encoding="utf-8"
        )
        stdout, stderr = result.stdout, result.stderr
        #print("DEBUG - returncode:", result.returncode)
        #print("DEBUG - stdout:", stdout[:1000])
        #print("DEBUG - stderr:", stderr[:1000])
    except Exception as e:
        stdout, stderr = "", str(e)
        #print("DEBUG - Exception:", e)
    finally:
        # 清理临时文件
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    new_screenshots = collect_new_screenshots(before_screenshots)
    return stdout, stderr, new_screenshots


def file_search(keywords):
    """
    只要文件内容包含 keywords 中任意一个即匹配
    keywords: list[str]
    """
    if isinstance(keywords, str):
        keywords = [keywords]

    if not keywords:
        return "[搜索失败] 关键词列表为空"

    keyword_lower_set = [kw.lower() for kw in keywords]

    if not os.path.isdir(SEARCH_ROOT):
        return "[搜索失败] 目录不存在: {}".format(SEARCH_ROOT)

    results = []

    for root, dirs, files in os.walk(SEARCH_ROOT):
        dirs[:] = [d for d in dirs if d not in (
            ".git", "node_modules", "__pycache__", ".venv", "venv",
            ".next", "dist", "build", "coverage"
        )]

        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                content_lower = content.lower()

                matched_kw = [kw for kw in keyword_lower_set if kw in content_lower]
                if not matched_kw:
                    continue

                lines = content.split("\n")
                matched_lines = []
                for i, line in enumerate(lines):
                    if any(kw in line.lower() for kw in keyword_lower_set):
                        start = max(0, i - 1)
                        end = min(len(lines), i + 2)
                        context = lines[start:end]
                        matched_lines.append(
                            "  L{}: ".format(i + 1) + "\n  ".join(context)
                        )

                rel_path = os.path.relpath(fpath, SEARCH_ROOT)
                kw_tag = "[匹配关键词: {}]".format(", ".join(matched_kw))
                results.append(
                    "{}\n{}\n{}".format(
                        kw_tag, rel_path, "\n".join(matched_lines[:64])
                    )
                )
            except Exception:
                continue

    if not results:
        return "[搜索完成] 未找到包含关键词 {} 的文件。".format(keywords)

    return "[搜索结果] 共找到 {} 个匹配文件：\n\n{}".format(
        len(results), "\n\n".join(results)
    )


# ──────────────────────────────────────────────
# 构造 tool_result（支持截图）
# ──────────────────────────────────────────────

def build_tool_result_with_screenshots(tool_use_id, stdout, stderr, screenshots):
    text_content = "执行日志：\n{}".format(stdout)
    if stderr.strip():
        text_content += "\n\n错误输出：\n{}".format(stderr)

    if not screenshots:
        return [{
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": text_content,
        }]
    else:
        blocks = [{"type": "text", "text": text_content}]
        for img_path in screenshots:
            blocks.append(image_to_content_block(img_path))
        return [{
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": blocks,
        }]


# ──────────────────────────────────────────────
# 提取最终脚本
# ──────────────────────────────────────────────

def extract_final_script(messages):
    """
    从对话历史中提取模型标记为 FINAL_VERSION 的 JavaScript 代码块。
    从最新消息往最旧遍历，取最后一个最终版本。
    """
    for msg in reversed(messages):
        if msg.get("role") != "assistant":
            continue

        for block in msg.get("content", []):
            if block.type != "text":
                continue

            text = block.text

            if "FINAL_VERSION" not in text:
                continue

            patterns = [
                r"```javascript\s*\n(.*?)```",
                r"```js\s*\n(.*?)```",
                r"```\s*\n(.*?)```",
            ]

            for pattern in patterns:
                matches = list(re.finditer(pattern, text, re.DOTALL | re.IGNORECASE))
                if matches:
                    code = matches[-1].group(1).strip()
                    if code:
                        return code

    return None


# ──────────────────────────────────────────────
# 完整 Prompt
# ──────────────────────────────────────────────

SYSTEM_PROMPT = (
    "你是一个 QA 自动化工程师。我需要你对给定的网址执行端到端测试。\n\n"
    "这是我注册好的测试网址账户和密码：3652750340@qq.com / abc.147258369\n\n"
    "--- 你的工作流程 ---\n\n"
    "你需要通过 tool_use 调用以下工具之一，循环迭代直到产出最终脚本：\n\n"
    "1. **code_execution**\n"
    "   - 用途：编写并执行 Playwright 测试脚本（JavaScript / @playwright/test）\n"
    "   - 参数：code（字符串），完整的可运行脚本\n"
    "   - 脚本要求：\n"
    "     - 必须包含断言，明确判断测试通过或失败\n"
    "     - 每个关键步骤用 console.log 记录测试日志\n"
    "     - 每个关键步骤的日志记录和截图记录保存到给定路径下\n"
    "     - 最终结果必须在日志中输出以下三者之一：\n"
    "       - TEST_PASSED（测试通过）\n"
    "       - TEST_FAILED（测试未通过）\n"
    "       - TEST_BLOCKED（测试受阻，并说明原因，如权限不足、元素未找到、页面未加载等）\n"
    "   - 执行结果（stdout / stderr）以及截图会一并返还给你\n"
    "   - 请结合截图分析页面实际渲染情况，判断选择器是否正确、元素是否可见\n\n"
    "2. **file_search**\n"
    "   - 用途：在代码仓库中搜索与测试相关的源码文件\n"
    "   - 参数：keywords（字符串数组），一个或多个搜索关键词\n"
    "   - 只要文件内容包含其中任意一个关键词即视为匹配\n"
    "   - 搜索结果会返还给你，帮助你理解页面结构和选择器\n\n"
    "3. **最终版本（终止）**\n"
    "   - 当你确认脚本可以正确运行，并能准确得出 通过/未通过/受阻 的结论时，即可输出最终版本\n"
    "   - 最终版本需要能够进行详细的日志和截图记录，并将日志和截图记录保存在给定路径下\n"
    "   - 最终版本必须用 Markdown 代码块包裹，标注语言为 javascript\n"
    "   - 输出中必须包含 '//FINAL_VERSION' 标记，否则我会继续期待你调用工具\n"
    "   - 最终版本不再调用任何 tool\n\n"
    "--- 迭代规则 ---\n"
    " - 根据每次工具返回的结果（执行日志、截图、搜索结果）分析并改进脚本\n"
    " - 如果代码执行报错，结合截图定位问题，修复后重新调用 code_execution\n"
    " - 如果不确定页面元素选择器，先调用 file_search 查找相关源码\n"
    " - 如果多次尝试后仍无法让脚本正常运行，可直接输出当前版本并标注 FINAL_VERSION\n"
    "   同时在脚本中让结果返回 TEST_BLOCKED 并说明原因\n"
    " - 脚本必须使用 Playwright Test 框架格式：\n"
    "   const { test, expect } = require('@playwright/test');\n"
    "   test('用例名称', async ({ page }) => { ... });\n"
    "   不要使用 Library 模式（chromium.launch）\n"
    " - 最终版本需要可复现测试结果，所以你需要避免会导致测试结果不可复现的问题\n"
    "   例如：用户名已经被注册过导致注册失败等\n"
    " - 你必须尽量使用较少对话轮数完成任务，防止上下文过长，token消耗量过大\n"
)


# ──────────────────────────────────────────────
# 核心 Agent 循环
# ──────────────────────────────────────────────

def run_agent(user_input, max_rounds=16, return_messages=False):
    """
    主循环：发送用户消息 -> 模型可能返回 tool_use -> 执行工具 -> 喂回结果 -> 直到模型输出最终文本
    """
    messages = [
        {"role": "user", "content": user_input}
    ]

    for round_num in range(max_rounds):
        print("\n" + "=" * 60)
        print("第 {} 轮对话".format(round_num + 1))
        print("=" * 60)

        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=messages,
            tools=TOOLS,
            system=SYSTEM_PROMPT,
        )

        # 打印模型回复
        for block in response.content:
            if block.type == "thinking":
                print("Thinking:\n{}\n".format(block.thinking))
            elif block.type == "text":
                print("Model:\n{}\n".format(block.text))
            elif block.type == "tool_use":
                print("Tool Use: {}".format(block.name))
                print("   Params: {}".format(json.dumps(block.input, ensure_ascii=False)))

        # 加入历史
        messages.append({"role": "assistant", "content": response.content})

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            print("\n模型未请求工具调用，视为最终回复。")
            break

        # 处理所有 tool_use
        tool_results = []
        for block in tool_calls:
            tool_name = block.name
            tool_input = block.input
            tool_use_id = block.id

            print("\n执行工具: {}".format(tool_name))

            if tool_name == "code_execution":
                stdout, stderr, screenshots = execute_code(tool_input.get("code", ""))
                print("   stdout 长度: {}".format(len(stdout)))
                print("   stderr 长度: {}".format(len(stderr)))
                print("   截图数量: {}".format(len(screenshots)))
                for s in screenshots:
                    print("   {}".format(os.path.basename(s)))

                tool_results.extend(
                    build_tool_result_with_screenshots(tool_use_id, stdout, stderr, screenshots)
                )

            elif tool_name == "file_search":
                keywords = tool_input.get("keywords", [])
                print("   关键词: {}".format(keywords))
                result = file_search(keywords)
                print("   结果:\n{}{}".format(
                    result[:300], "..." if len(result) > 300 else ""
                ))

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result,
                })

            else:
                print("   未知工具: {}".format(tool_name))
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": "[未知工具] {}".format(tool_name),
                })

        messages.append({"role": "user", "content": tool_results})

    else:
        print("\n达到最大轮次 ({})，停止循环。".format(max_rounds))

    if return_messages:
        return messages
    return None


# ──────────────────────────────────────────────
# 从 tests.json 读取并构造 prompt
# ──────────────────────────────────────────────

def get_prompts_from_file(file_path="tests.json"):
    """
    从指定文件中读取测试用例，逐个构造 prompt
    """
    web_url = "https://demo.4gaboards.com/"

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError("测试用例文件不存在: {}".format(file_path))
    except json.JSONDecodeError:
        raise ValueError("文件格式错误，不是合法的 JSON: {}".format(file_path))

    prompts = []
    for category in data:
        for case in category.get("test_cases", []):
            name = case.get("name", "未命名用例")
            steps = case.get("steps", [])
            expectation = case.get("expectation", "无预期结果")

            steps_text = "\n".join(
                "  {}. {}".format(i + 1, step) for i, step in enumerate(steps)
            )

            prompt = (
                "请对以下网址执行端到端测试：\n"
                "网址首页: {}\n\n"
                "测试用例名称: {}\n"
                "操作步骤:\n{}\n"
                "预期结果: {}\n\n"
                "日志记录和截图记录保存路径：D:\\VSCode\\playwright\\output\\{}\n\n"
                "请编写 Playwright 测试脚本完成该测试，并根据执行结果迭代优化，"
                "直到脚本能正确输出 TEST_PASSED / TEST_FAILED / TEST_BLOCKED 之一。"
            ).format(web_url, name, steps_text, expectation, name)

            prompts.append({
                "category": category.get("category", ""),
                "name": name,
                "prompt": prompt,
            })

    return prompts


# ──────────────────────────────────────────────
# 入口
# ──────────────────────────────────────────────

if __name__ == "__main__":
    OUTPUT_DIR = r"D:\software_course\final\generated_tests"
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 用法说明：
    #   python main.py              -> 批量运行 tests.json 中所有用例
    #   python main.py --single    -> 手动输入单个测试需求
    mode = "batch"
    if len(sys.argv) > 1 and sys.argv[1] == "--single":
        mode = "single"

    if mode == "single":
        # 单次模式：手动输入测试需求
        print("请输入测试需求描述：")
        user_text = input(">>> ")
        if user_text.strip():
            run_agent(user_text.strip())
        else:
            print("输入为空，退出。")

    else:
        # 批量模式：从 tests.json 读取所有用例
        TESTS_FILE = r"D:\software_course\final\tests.json"
        prompts = get_prompts_from_file(TESTS_FILE)

        results = []

        for item in prompts:
            name = item["name"]
            prompt = item["prompt"]

            #提前生成安全文件名并检查是否已存在
            safe_name = re.sub(r'[\\/:*?"<>|]', "_", name)
            out_path = os.path.join(OUTPUT_DIR, "{}.spec.js".format(safe_name))

            # 【新增】跳过已生成的测试用例
            if os.path.exists(out_path):
                print("\n" + "#" * 60)
                print("# 跳过已存在的测试用例: {}".format(name))
                print("# 已存在文件: {}".format(out_path))
                print("#" * 60)
                results.append({
                    "name": name,
                    "output_path": out_path,
                    "status": "SKIPPED"
                })
                continue  # 直接进入下一个用例

            # 不存在则正常执行测试流程
            print("\n" + "#" * 60)
            print("# 开始测试: {}".format(name))
            print("#" * 60)

            messages = run_agent(prompt, max_rounds=1024, return_messages=True)
            script = extract_final_script(messages)

            if script:
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(script)
                print("脚本已保存: {}".format(out_path))
            else:
                print("未找到 FINAL_VERSION 脚本，跳过保存")

            results.append({
                "name": name,
                "output_path": out_path if script else None,
            })

        # 输出汇总
        print("\n" + "=" * 60)
        print("全部完成！共 {} 个用例".format(len(results)))
        for r in results:
            status = "OK" if r["output_path"] else "FAIL"
            print("  [{}] {}  ->  {}".format(
                status, r["name"], r["output_path"] or "未生成"
            ))
        print("脚本保存目录: {}".format(OUTPUT_DIR))
        print("=" * 60)