from models.schemas import StudentAskResponse


class RAGService:
    """
    RAG 占位实现：返回固定答案和引用示例。
    后续接入向量检索 + LLM 生成。
    """

    async def ask(self, question: str) -> StudentAskResponse:
        answer = (
            "这是占位回答。后续将根据向量检索出的题目与解析生成定制化解答。\n"
            f"你的问题是：{question}"
        )
        related = [
            {"id": "q_stub_1", "questionText": "示例题目 1", "similarity": 0.8},
            {"id": "q_stub_2", "questionText": "示例题目 2", "similarity": 0.75},
        ]
        sources = [item["id"] for item in related]
        return StudentAskResponse(answer=answer, relatedQuestions=related, sources=sources)
