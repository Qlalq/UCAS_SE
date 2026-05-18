"""
=============================================================================
4ga Boards 测试用例自动生成工具（三种模式）
=============================================================================
输入 : 包含 .md 文档的目录（支持多份文档）
输出 : tests.json（72 个测试点，12 个功能分类）

运行方式 :
    # 模式1: 混合检索（默认，向量40% + BM25 60%）
    python generate_tests.py --docs ./docs --output ./tests_hybrid.json --regenerate

    # 模式2: 纯向量检索（对比用）
    python generate_tests.py --docs ./docs --output ./tests_vec.json --mode vector --regenerate

    # 模式3: 全文检索（纯 BM25，对比用）
    python generate_tests.py --docs ./docs --output ./tests_bm25.json --mode bm25 --regenerate

    # 模式4: 直接喂文档（不做 RAG，整份文档直接给 LLM）
    python generate_tests.py --docs ./docs --output ./tests_full.json --mode full-doc --regenerate

    # Dry-run（不调 LLM，只看检索效果）
    python generate_tests.py --docs ./docs --output ./tests.json --dry-run
=============================================================================
"""

import json
import os
import re
import sys
import math
import argparse
from collections import Counter
from pathlib import Path

# --------------------------------------------------------------------------
# 依赖检查
# --------------------------------------------------------------------------
try:
    import anthropic
except ImportError:
    print("请先安装 anthropic SDK: pip install anthropic")
    sys.exit(1)

# ==========================================================================
# 全局配置
# ==========================================================================

# 12 个功能分类的测试点配比: 8+8+13+5+4+4+3+12+5+4+3+3 = 72
count_scale = 1
N_CATEGORIES = 12
TARGET_TEST_POINTS = 72 * count_scale

FEATURE_AREAS = [
    {
        "category": "用户级模块",
        "count": 8* count_scale,
        "query": "user account register login SSO password authentication sign-in sign-up",
        "description": "覆盖新用户注册、SSO 登录、密码管理、注册禁用、用户实例设置等账户相关功能"
    },
    {
        "category": "项目/看板管理",
        "count": 8 * count_scale,
        "query": "project board create delete rename template kanban simple import",
        "description": "覆盖项目、看板的创建、删除、重命名、模板选择、上下文菜单、导入等管理功能"
    },
    {
        "category": "卡片核心功能",
        "count": 13 * count_scale,
        "query": "card create move delete duplicate copy link menu label member due date timer task attachment comment cover",
        "description": "覆盖卡片的创建、移动、删除、复制、标签、成员、截止日期、计时器、子任务、附件、评论、封面、描述编辑等所有卡片相关功能"
    },
    {
        "category": "导入/导出",
        "count": 5 * count_scale,
        "query": "import export trello tgz csv migrate file json",
        "description": "覆盖从 Trello、4ga Boards 导入，以及导出 tgz、csv 等数据迁移功能"
    },
    {
        "category": "权限矩阵",
        "count": 4 * count_scale,
        "query": "permission role manager editor commenter viewer access control",
        "description": "覆盖 Project Manager、Editor、Commenter、Viewer 等角色权限的检查与控制"
    },
    {
        "category": "通知系统",
        "count": 4 * count_scale,
        "query": "notification bell center filter read unread activity log subscribe",
        "description": "覆盖通知中心、通知过滤、已读 / 未读切换、删除、订阅设置、活动日志等功能"
    },
    {
        "category": "API",
        "count": 3 * count_scale,
        "query": "api client secret endpoint curl authentication oauth",
        "description": "覆盖 API 认证、调用与权限控制等功能"
    },
    {
        "category": "管理员级功能",
        "count": 12 * count_scale,
        "query": "admin instance users management configuration options system log dashboard",
        "description": "覆盖实例设置、用户管理、系统参数、角色权限分配、系统日志 / 监控等管理员功能"
    },
    {
        "category": "列表管理",
        "count": 5 * count_scale,
        "query": "list add edit delete hide show drag order navigation card column",
        "description": "覆盖列表的创建、编辑、删除、隐藏 / 显示、拖拽排序、活动记录等功能"
    },
    {
        "category": "个人设置",
        "count": 4 * count_scale,
        "query": "profile preference language theme view style sidebar account authentication about",
        "description": "覆盖个人资料、语言、主题、默认视图、侧边栏样式、账户、认证、关于等设置"
    },
    {
        "category": "视图管理",
        "count": 3 * count_scale,
        "query": "view board list sort column width filter toggle default compact",
        "description": "覆盖 Board View、List View 的切换、列宽调整、排序、列管理、过滤等功能"
    },
    {
        "category": "日志管理",
        "count": 3 * count_scale,
        "query": "log logrotate fail2ban docker compose nginx volume rotate",
        "description": "覆盖日志暴露、轮转、Fail2ban、Nginx 等运维相关功能"
    },
]

# 编译期断言
assert len(FEATURE_AREAS) == N_CATEGORIES, (
    f"分类数异常: 期望 {N_CATEGORIES}, 实际 {len(FEATURE_AREAS)}"
)
assert sum(a['count'] for a in FEATURE_AREAS) == TARGET_TEST_POINTS, (
    f"测试点配比之和异常: 期望 {TARGET_TEST_POINTS}, "
    f"实际 {sum(a['count'] for a in FEATURE_AREAS)}"
)

# ==========================================================================
# LLM 客户端（Anthropic SDK + MiniMax API）
# ==========================================================================

class LLMClient:
    """使用 Anthropic SDK 调用 MiniMax M3 模型"""

    def __init__(
        self,
        base_url: str = "https://api.minimaxi.com/anthropic",
        api_key: str = "sk-cp-sWh8llmWNSDLwkkvgIPixzgdMog8C3eIVm6gMPsDXP5HczBCFhdGjx3XXmoYrTthvXL8JAr-YY36t9OheGwdkmNj7xz7hVmjYPx7vYhA8JFVz9WczT6YUVE",
        model: str = "MiniMax-M3",
    ):
        for var in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
            os.environ.pop(var, None)

        self.client = anthropic.Anthropic(
            base_url=base_url,
            api_key=api_key,
        )
        self.model = model

    def ask(self, prompt: str, max_tokens: int = 8192*2) -> str:
        """调用 LLM，返回纯文本响应"""
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            text_parts = []
            for block in message.content:
                if block.type == "text":
                    text_parts.append(block.text)
            return "".join(text_parts)
        except Exception as e:
            return str(e)
        
    def _ask(self, prompt: str, max_tokens: int = 8192) -> str:
        try:
            # ✅ 使用流式传输
            response_text = ""
            with self.client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    response_text += text
            
            return response_text
        except Exception as e:
            return str(e)


# ==========================================================================
# DocumentProcessor —— Markdown 文档加载 + 章节拆分
# ==========================================================================

class DocumentProcessor:
    """加载目录下的所有 .md 文件，按标题拆分成 chunk"""

    def __init__(self, docs_dir: str | Path):
        self.docs_dir = Path(docs_dir)
        self.sections: list[dict] = []
        self.max_chunk_len = 800
        self.overlap_len = 150
        self.min_chunk_len = 50

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------
    def build_knowledge_base(self) -> list[dict]:
        files = self._load_markdown_files()
        self.sections = []
        for file_name, content in files:
            prefixed = f"# 文件: {file_name}\n\n{content}"
            self.sections.extend(self._parse_sections(prefixed))
        return self.sections

    def load_all_text(self) -> str:
        """将所有 .md 文件合并为一份完整文本（用于 full-doc 模式）"""
        files = self._load_markdown_files()
        return "\n\n".join(content for _, content in files)

    def get_file_info(self) -> list[tuple[str, int]]:
        """返回 [(文件名, 字符数), ...]"""
        files = self._load_markdown_files()
        return [(name, len(content)) for name, content in files]

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------
    def _load_markdown_files(self) -> list[tuple[str, str]]:
        md_files = sorted(self.docs_dir.glob("*.md"))
        if not md_files:
            raise FileNotFoundError(f"目录 {self.docs_dir} 下未找到任何 .md 文件")
        results = []
        for md_file in md_files:
            with open(md_file, "r", encoding="utf-8") as f:
                results.append((md_file.name, f.read()))
        return results

    def _clean_markdown(self, text: str) -> str:
        text = re.sub(r"```[\s\S]*?```", lambda m: m.group(0).replace("```", ""), text)
        text = re.sub(r"\|\s*[-:]+\s*\|", "", text)
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _split_long_section(self, title: str, level: int, content: str) -> list[dict]:
        if len(content) <= self.max_chunk_len:
            return [{"title": title, "level": level, "content": content}]

        chunks = []
        start = 0
        while start < len(content):
            end = start + self.max_chunk_len
            chunk_content = content[start:end]

            split_pos = max(
                chunk_content.rfind("."),
                chunk_content.rfind("\n"),
                chunk_content.rfind("。"),
            )
            if split_pos > int(self.max_chunk_len * 0.6):
                end = start + split_pos + 1
                chunk_content = content[start:end]

            if len(chunk_content.strip()) >= self.min_chunk_len:
                chunks.append({
                    "title": title,
                    "level": level,
                    "content": chunk_content.strip(),
                })

            start = max(end - self.overlap_len, end)

        return chunks    
    
    def _parse_sections(self, text: str) -> list[dict]:
        pattern = r"^(#{1,3})\s+(.+)$"
        lines = text.split("\n")
        raw_sections = []
        current = {"title": "", "level": 0, "content": ""}

        for line in lines:
            match = re.match(pattern, line)
            if match:
                if current["title"] or current["content"].strip():
                    raw_sections.append(current)
                current = {
                    "title": match.group(2).strip(),
                    "level": len(match.group(1)),
                    "content": "",
                }
            else:
                current["content"] += line + "\n"

        if current["title"] or current["content"].strip():
            raw_sections.append(current)

        if not raw_sections:
            raw_sections = [{"title": "全文", "level": 1, "content": text}]

        sections = []
        for sec in raw_sections:
            cleaned = self._clean_markdown(sec["content"])
            if len(cleaned) < self.min_chunk_len:
                if sec["title"]:
                    sections.append({
                        "title": sec["title"],
                        "level": sec["level"],
                        "content": cleaned,
                    })
                continue
            chunks = self._split_long_section(sec["title"], sec["level"], cleaned)
            sections.extend(chunks)

        return sections


# ==========================================================================
# RAGSystem —— 支持三种检索模式
# ==========================================================================

class RAGSystem:
    """
    三种检索模式，通过 mode 参数切换：
    - "hybrid" : TF 向量(40%) + BM25(60%) 融合（默认）
    - "vector"  : 纯 TF 向量检索
    - "bm25"    : 纯 BM25 全文检索
    """

    def __init__(self, mode: str = "hybrid"):
        self.mode = mode
        self.documents: list[dict] = []
        self.vocab: dict[str, int] = {}
        self.document_vectors: list[list[int]] = []

        # BM25
        self.bm25_idf: dict[str, float] = {}
        self.bm25_tf: list[Counter] = []
        self.avgdl: float = 0.0
        self.N: int = 0

        self.k1 = 1.5
        self.b = 0.75

    # ------------------------------------------------------------------
    # 分词
    # ------------------------------------------------------------------
    def tokenize(self, text: str) -> list[str]:
        text = text.lower()
        return re.findall(r"[a-z0-9]+", text)

    # ------------------------------------------------------------------
    # TF 向量
    # ------------------------------------------------------------------
    def build_vocab(self, texts: list[str]):
        vocab: dict[str, int] = {}
        idx = 0
        for text in texts:
            for token in self.tokenize(text):
                if token not in vocab:
                    vocab[token] = idx
                    idx += 1
        self.vocab = vocab

    def text_to_vector(self, text: str) -> list[int]:
        counter = Counter(self.tokenize(text))
        vector = [0] * len(self.vocab)
        for token, count in counter.items():
            if token in self.vocab:
                vector[self.vocab[token]] = count
        return vector

    def cosine_similarity(self, vec1: list[int], vec2: list[int]) -> float:
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)

    # ------------------------------------------------------------------
    # BM25
    # ------------------------------------------------------------------
    def _build_bm25(self, texts: list[str]):
        self.N = len(texts)
        self.bm25_tf = []
        doc_lens = []
        df_counter: Counter = Counter()

        for text in texts:
            tokens = self.tokenize(text)
            tf = Counter(tokens)
            self.bm25_tf.append(tf)
            doc_lens.append(len(tokens))
            for t in set(tokens):
                df_counter[t] += 1

        self.avgdl = sum(doc_lens) / max(1, self.N)
        self.bm25_idf = {}
        for t, df in df_counter.items():
            self.bm25_idf[t] = math.log((self.N - df + 0.5) / (df + 0.5) + 1)

    def _bm25_score(self, query: str, doc_id: int) -> float:
        score = 0.0
        tf_dict = self.bm25_tf[doc_id]
        dl = sum(tf_dict.values())
        for token in self.tokenize(query):
            if token not in self.bm25_idf:
                continue
            tf = tf_dict.get(token, 0)
            if tf == 0:
                continue
            idf = self.bm25_idf[token]
            denom = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            score += idf * (tf * (self.k1 + 1) / denom)
        return score

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------
    def build_index(self, documents: list[dict]):
        self.documents = documents
        texts = [
            doc["content"] if isinstance(doc, dict) else doc
            for doc in documents
        ]
        self.build_vocab(texts)
        self.document_vectors = [self.text_to_vector(t) for t in texts]
        self._build_bm25(texts)

    def search(self, query: str, top_k: int = 8) -> list[dict]:
        """根据 mode 选择检索策略"""
        if self.mode == "vector":
            return self._search_vector(query, top_k)
        elif self.mode == "bm25":
            return self._search_bm25(query, top_k)
        else:  # hybrid
            return self._search_hybrid(query, top_k)

    # ---------- 纯向量 ----------
    def _search_vector(self, query: str, top_k: int) -> list[dict]:
        query_vec = self.text_to_vector(query)
        scores = [
            self.cosine_similarity(query_vec, dv)
            for dv in self.document_vectors
        ]
        scored = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        return [
            {"document": self.documents[idx], "similarity": float(score)}
            for idx, score in scored[:top_k]
        ]

    # ---------- 纯 BM25 ----------
    def _search_bm25(self, query: str, top_k: int) -> list[dict]:
        scores = [self._bm25_score(query, i) for i in range(len(self.documents))]
        scored = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        return [
            {"document": self.documents[idx], "similarity": float(score)}
            for idx, score in scored[:top_k]
        ]

    # ---------- 混合 ----------
    def _search_hybrid(self, query: str, top_k: int) -> list[dict]:
        query_vec = self.text_to_vector(query)

        vec_scores = [
            self.cosine_similarity(query_vec, dv)
            for dv in self.document_vectors
        ]
        bm25_scores = [self._bm25_score(query, i) for i in range(len(self.documents))]

        def normalize(scores: list[float]) -> list[float]:
            mn, mx = min(scores), max(scores)
            if mx - mn < 1e-8:
                return [0.0] * len(scores)
            return [(s - mn) / (mx - mn) for s in scores]

        vec_norm = normalize(vec_scores)
        bm25_norm = normalize(bm25_scores)

        hybrid = [0.4 * v + 0.6 * b for v, b in zip(vec_norm, bm25_norm)]

        scored = sorted(enumerate(hybrid), key=lambda x: x[1], reverse=True)
        return [
            {"document": self.documents[idx], "similarity": float(score)}
            for idx, score in scored[:top_k]
        ]


# ==========================================================================
# TestScenarioGenerator —— 主流程编排（三种模式）
# ==========================================================================

class TestScenarioGenerator:
    """支持 hybrid / vector / bm25 / full-doc 四种模式"""

    def __init__(self, docs_dir: str | Path, mode: str = "hybrid"):
        self.docs_dir = Path(docs_dir)
        self.processor = DocumentProcessor(docs_dir)
        self.rag = RAGSystem(mode=mode)
        self.llm = LLMClient()
        self.mode = mode

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------
    @staticmethod
    def count_test_points(scenarios: list[dict]) -> int:
        return sum(len(item.get("test_cases", [])) for item in scenarios)

    @staticmethod
    def clean_json_response(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text[3:].strip()
            if text.endswith("```"):
                text = text[:-3].strip()
        if text.startswith("json"):
            text = text[4:].strip()
        return text

    # ------------------------------------------------------------------
    # RAG 索引构建
    # ------------------------------------------------------------------
    def _build_rag_index(self) -> int:
        self.processor.build_knowledge_base()
        documents = [
            {"content": f"{s['title']}\n{s['content']}"}
            for s in self.processor.sections
            if s.get("content", "").strip()
        ]
        if not documents:
            raise ValueError("文档中未提取到任何可用内容")
        self.rag.build_index(documents)
        return len(documents)

    # ------------------------------------------------------------------
    # Prompt 构建
    # ------------------------------------------------------------------
    @staticmethod
    def _build_prompt(area: dict, context: str, n_cases: int) -> str:
        return f"""
你是 4ga Boards 项目的测试工程师。4ga Boards 是一个看板式项目管理工具，支持多级项目管理、看板、列表、卡片、任务、标签、通知等功能。

请基于下面【用户手册相关内容】，把内容**格式化为**恰好 {n_cases} 个标准的测试用例。
注意：你不是凭空生成，而是把用户手册里关于该功能分类的内容，整理成结构化的测试用例。

【功能分类】{area['category']}
【分类描述】{area['description']}

【用户手册相关内容】
{context}

【输出格式】
请严格按照以下 JSON 格式输出恰好 {n_cases} 个测试用例（不要多也不要少，不要用 markdown 代码块包裹）：

{{
  "test_cases": [
    {{
      "name": "测试用例名称（10-20 字，简洁描述该用例测什么）",
      "steps": ["操作步骤1", "操作步骤2", "操作步骤3"],
      "expectation": "预期结果（1-2 句话，明确可观察可验证）"
    }}
  ]
}}

【质量要求】
1. 恰好 {n_cases} 个测试用例，覆盖该分类下的不同方面（基本操作、边界、异常、权限等）
2. 每个用例的 steps 必须是用户在 UI 中可执行的具体动作
3. 每个用例的 expectation 必须能从界面或系统状态直接观察到
4. 名称、步骤、预期都要用中文
5. 严格只输出上述 JSON，不要输出任何解释、注释或 markdown
6. 步骤文本中不要使用双引号包裹任何内容，如需引用界面文字，使用「」或【】代替。例如：检查列表中是否包含「List」列
"""

    # full-doc 模式专用 prompt（把整份文档直接喂给 LLM）
    @staticmethod
    def _build_full_doc_prompt(area: dict, full_doc: str, n_cases: int) -> str:
        return f"""
你是 4ga Boards 项目的测试工程师。4ga Boards 是一个看板式项目管理工具，支持多级项目管理、看板、列表、卡片、任务、标签、通知等功能。

请基于下面【完整的用户手册内容】，为"{area['category']}"功能分类生成恰好 {n_cases} 个标准的测试用例。

【功能分类】{area['category']}
【分类描述】{area['description']}

【完整用户手册内容】
{full_doc}

【输出格式】
请严格按照以下 JSON 格式输出恰好 {n_cases} 个测试用例（不要多也不要少，不要用 markdown 代码块包裹）：

{{
  "test_cases": [
    {{
      "name": "测试用例名称（10-20 字，简洁描述该用例测什么）",
      "steps": ["操作步骤1", "操作步骤2", "操作步骤3"],
      "expectation": "预期结果（1-2 句话，明确可观察可验证）"
    }}
  ]
}}

【质量要求】
1. 恰好 {n_cases} 个测试用例，覆盖该分类下的不同方面（基本操作、边界、异常、权限等）
2. 每个用例的 steps 必须是用户在 UI 中可执行的具体动作
3. 每个用例的 expectation 必须能从界面或系统状态直接观察到
4. 名称、步骤、预期都要用中文
5. 严格只输出上述 JSON，不要输出任何解释、注释或 markdown
"""

    # ------------------------------------------------------------------
    # LLM 响应解析 + 兜底
    # ------------------------------------------------------------------
    @staticmethod
    def _fallback_case(category_name: str, idx: int) -> dict:
        return {
            "name": f"{category_name} - 测试场景 {idx}",
            "steps": [
                f"打开 4ga Boards 界面",
                f"进入「{category_name}」相关页面",
                "按用户手册执行相应操作",
                "观察系统反馈",
            ],
            "expectation": f"操作结果应符合用户手册关于「{category_name}」的描述",
        }

    def _parse_test_cases(self, response: str, n_cases: int, category_name: str) -> list[dict]:
        print(f"  [DEBUG] response len={len(response)}")
        print(f"  [DEBUG] response start={repr(response[:300])}")
        test_cases = []
        try:
            cleaned = self.clean_json_response(response)
            print(f"  [DEBUG] cleaned start={repr(cleaned[:300])}")
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and "test_cases" in parsed:
                raw = parsed["test_cases"]
            elif isinstance(parsed, list):
                raw = parsed
            else:
                raw = []

            for tc in raw:
                if not isinstance(tc, dict):
                    continue
                if "name" not in tc or "steps" not in tc:
                    continue
                steps = tc["steps"] if isinstance(tc["steps"], list) else [str(tc["steps"])]
                if not steps:
                    continue
                expectation = tc.get("expectation") or f"操作结果应符合用户手册关于「{category_name}」的描述"
                test_cases.append({
                    "name": str(tc["name"]).strip(),
                    "steps": [str(s).strip() for s in steps if str(s).strip()],
                    "expectation": str(expectation).strip(),
                })
        except Exception as e:
            print(f"  [WARN] LLM 响应解析失败: {e}")

        if len(test_cases) < n_cases:
            for i in range(len(test_cases), n_cases):
                test_cases.append(self._fallback_case(category_name, i + 1))
        else:
            test_cases = test_cases[:n_cases]
        return test_cases

    # ------------------------------------------------------------------
    # 单个分类：RAG 检索 + LLM 生成
    # ------------------------------------------------------------------
    def _generate_for_area_rag(self, area: dict, dry_run: bool = False) -> list[dict]:
        n_cases = area["count"]
        mode_label = self.mode.upper()

        relevant_docs = self.rag.search(area["query"], top_k=8)
        if relevant_docs:
            top_sim = relevant_docs[0]["similarity"]
            print(f"  [{mode_label}] top-8, 最高分数={top_sim:.3f}")
        else:
            print(f"  [{mode_label}] 未找到相关章节")

        context = "\n\n".join(
            doc["document"]["content"][:1000] for doc in relevant_docs
        )

        if dry_run:
            return self._dry_run_cases(area, relevant_docs, n_cases)

        if not context:
            print(f"  [WARN] 无上下文，使用兜底用例")
            return [self._fallback_case(area["category"], i + 1) for i in range(n_cases)]

        prompt = self._build_prompt(area, context, n_cases)
        try:
            response = self.llm.ask(prompt)
        except Exception as e:
            print(f"  [WARN] LLM 调用失败: {e}，使用兜底用例")
            return [self._fallback_case(area["category"], i + 1) for i in range(n_cases)]

        test_cases = self._parse_test_cases(response, n_cases, area["category"])
        llm_count = sum(
            1 for tc in test_cases
            if not tc["name"].startswith(f"{area['category']} - 测试场景")
        )
        print(f"  LLM 格式化: {llm_count}/{n_cases} 个用例来自 LLM（其余兜底）")
        return test_cases

    # ------------------------------------------------------------------
    # 单个分类：直接喂文档（full-doc 模式）
    # ------------------------------------------------------------------
    def _generate_for_area_full_doc(self, area: dict, full_doc: str, dry_run: bool = False) -> list[dict]:
        n_cases = area["count"]

        if dry_run:
            print(f"  [FULL-DOC] 跳过 LLM（dry-run 模式）")
            return [self._fallback_case(area["category"], i + 1) for i in range(n_cases)]

        prompt = self._build_full_doc_prompt(area, full_doc, n_cases)
        try:
            response = self.llm.ask(prompt)
        except Exception as e:
            print(f"  [WARN] LLM 调用失败: {e}，使用兜底用例")
            return [self._fallback_case(area["category"], i + 1) for i in range(n_cases)]

        test_cases = self._parse_test_cases(response, n_cases, area["category"])
        llm_count = sum(
            1 for tc in test_cases
            if not tc["name"].startswith(f"{area['category']} - 测试场景")
        )
        print(f"  LLM 生成: {llm_count}/{n_cases} 个用例来自 LLM（其余兜底）")
        return test_cases

    # ------------------------------------------------------------------
    # Dry-run 占位
    # ------------------------------------------------------------------
    @staticmethod
    def _dry_run_cases(area: dict, relevant_docs: list, n_cases: int) -> list[dict]:
        cases = []
        for i in range(n_cases):
            if relevant_docs:
                doc = relevant_docs[i % len(relevant_docs)]
                lines = [
                    ln.strip() for ln in doc["document"]["content"].split("\n")
                    if len(ln.strip()) > 20 and not ln.strip().startswith("[")
                ][:2]
                if not lines:
                    lines = [doc["document"]["content"][:200]]
                steps = lines + ["按用户手册验证操作结果"]
                name_seed = doc["document"]["content"].split("\n")[0].strip()[:30]
                expectation = (
                    f"操作结果应符合「{area['category']}」章节描述"
                    f"（参考 RAG top-1: {name_seed}）"
                )
            else:
                steps = [
                    f"打开 4ga Boards 界面",
                    f"进入「{area['category']}」相关页面",
                ]
                expectation = f"操作结果应符合用户手册关于「{area['category']}」的描述"
            cases.append({
                "name": f"{area['category']} - 测试场景 {i + 1}",
                "steps": steps,
                "expectation": expectation,
            })
        return cases

    # ------------------------------------------------------------------
    # 主流程
    # ------------------------------------------------------------------
    def run(self, output_path: str | Path, force_regenerate: bool = False, dry_run: bool = False):
        """执行测试场景自动生成"""
        mode = self.mode
        print("=" * 60)
        print("  4ga Boards 测试用例自动生成")
        print("=" * 60)
        counts = [a["count"] for a in FEATURE_AREAS]
        print(f"切分结构: {N_CATEGORIES} 类，配比 {counts}，合计 {sum(counts)}")

        if mode == "full-doc":
            print(f"运行模式: [FULL-DOC] 整份文档直接喂给 LLM（无 RAG）")
        elif mode == "hybrid":
            print(f"运行模式: [FULL] 混合检索（向量40% + BM25 60%）")
        elif mode == "vector":
            print(f"运行模式: [FULL] 纯向量检索")
        elif mode == "bm25":
            print(f"运行模式: [FULL] 纯 BM25 全文检索")
        else:
            print(f"运行模式: [FULL] 未知模式: {mode}")

        # Step 1: 加载文档
        file_info = self.processor.get_file_info()
        total_chars = sum(c for _, c in file_info)
        print(f"\n[1/3] 加载文档...")
        for name, chars in file_info:
            print(f"  📄 {name} ({chars:,} 字符)")

        # full-doc 模式：合并所有文档
        if mode == "full-doc":
            full_doc = self.processor.load_all_text()
            print(f"  合并文档总字符数: {len(full_doc):,}")
            # 检查是否超过 LLM 上下文窗口（预留 8000 tokens 给 prompt + 输出）
            est_tokens = len(full_doc) / 3  # 粗略估计
            if est_tokens > 120000:  # MiniMax M3 上下文窗口较大，但仍需警告
                print(f"  ⚠️ 估计 token 数约 {est_tokens:,.0f}，可能接近或超过模型上下文上限")
                print(f"     建议：使用 --mode hybrid 做 RAG 检索，避免上下文溢出")
            step1_done = True
        else:
            # RAG 模式：构建索引
            print(f"\n[1/3] 构建 RAG 索引...")
            n_indexed = self._build_rag_index()
            print(f"  索引完成，覆盖 {n_indexed} 个文档片段")

        # Step 2: 按 12 个功能分类生成
        all_scenarios: list[dict] = []
        print(f"\n[2/3] 按 {N_CATEGORIES} 个功能分类生成测试用例...")

        for i, area in enumerate(FEATURE_AREAS, 1):
            print(f"\n[{i:2d}/{N_CATEGORIES}] {area['category']} (分配 {area['count']} 个测试点)")

            if mode == "full-doc":
                test_cases = self._generate_for_area_full_doc(area, full_doc, dry_run=dry_run)
            else:
                test_cases = self._generate_for_area_rag(area, dry_run=dry_run)

            all_scenarios.append({
                "category": area["category"],
                "feature": area["category"],
                "test_cases": test_cases,
            })

        # Step 3: 校验 + 保存
        total = self.count_test_points(all_scenarios)
        assert total == TARGET_TEST_POINTS, (
            f"测试点总数异常: 期望 {TARGET_TEST_POINTS}, 实际 {total}"
        )
        actual = [len(s["test_cases"]) for s in all_scenarios]
        expected = [a["count"] for a in FEATURE_AREAS]
        assert actual == expected, (
            f"每类测试点数量与配比不一致:\n  期望: {expected}\n  实际: {actual}"
        )

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"\n[3/3] 保存到 {output_path}")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_scenarios, f, ensure_ascii=False, indent=2)

        print(f"\n✅ 测试场景已保存到: {output_path}")
        print(f"   共 {len(all_scenarios)} 个分类，{total} 个测试点")
        if dry_run:
            print(f"   ⚠️ 当前为 DRY-RUN 模式，用例为占位内容")
        return all_scenarios


# ==========================================================================
# 命令行入口
# ==========================================================================

def main():
    parser = argparse.ArgumentParser(
        description="4ga Boards 测试用例自动生成工具（支持 4 种模式）"
    )
    parser.add_argument(
        "--docs", "-d", required=True,
        help="包含 .md 文档的目录路径（支持多份文档）",
    )
    parser.add_argument(
        "--output", "-o", default="tests.json",
        help="输出 tests.json 的路径（默认 ./tests.json）",
    )
    parser.add_argument(
        "--mode", "-m", default="hybrid",
        choices=["hybrid", "vector", "bm25", "full-doc"],
        help=(
            "检索模式: hybrid=混合检索(默认), vector=纯向量, "
            "bm25=纯全文检索, full-doc=整份文档直接喂LLM（无RAG）"
        ),
    )
    parser.add_argument(
        "--regenerate", "-r", action="store_true",
        help="强制重新生成（忽略已有输出文件）",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="跳过 LLM 调用，仅测试检索效果 / 查看文档信息",
    )

    args = parser.parse_args()

    # 验证输入目录
    docs_dir = Path(args.docs)
    if not docs_dir.exists():
        print(f"❌ 错误: 文档目录不存在: {docs_dir}")
        sys.exit(1)
    md_files = sorted(docs_dir.glob("*.md"))
    if not md_files:
        print(f"❌ 错误: 目录 {docs_dir} 下未找到任何 .md 文件")
        sys.exit(1)
    print(f"📄 发现 {len(md_files)} 份文档: {[f.name for f in md_files]}")

    # 运行生成
    generator = TestScenarioGenerator(docs_dir, mode=args.mode)
    generator.run(
        output_path=args.output,
        force_regenerate=args.regenerate,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
