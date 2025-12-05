"""
试卷模板定义与校验
- 支持多模板，当前实现 gaokao_new_1（19题，150分）
"""

from typing import List, Optional
from pydantic import BaseModel


class TemplateSlot(BaseModel):
    order: int
    question_type: str  # choice/multi/fillblank/solve/proof
    default_score: int


class PaperTemplate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    slots: List[TemplateSlot]
    total_score: int


def get_templates() -> dict:
    # 2025 全国卷 I 新高考（19 题：8单选、3多选、3填空、5解答）
    slots: List[TemplateSlot] = []
    # 单选 8*5
    for i in range(8):
        slots.append(TemplateSlot(order=i + 1, question_type="choice", default_score=5))
    # 多选 3*6
    for i in range(3):
        slots.append(TemplateSlot(order=9 + i, question_type="multi", default_score=6))
    # 填空 3*5
    for i in range(3):
        slots.append(TemplateSlot(order=12 + i, question_type="fillblank", default_score=5))
    # 解答 5* (13,15,15,17,17)
    solve_scores = [13, 15, 15, 17, 17]
    for idx, sc in enumerate(solve_scores):
        slots.append(TemplateSlot(order=15 + idx, question_type="solve", default_score=sc))

    tpl_gaokao_new_1 = PaperTemplate(
        id="gaokao_new_1",
        name="2025 全国卷 I（新高考）",
        description="19 题：单选8、多选3、填空3、解答5",
        slots=slots,
        total_score=150,
    )
    return {tpl_gaokao_new_1.id: tpl_gaokao_new_1}


def get_template(template_id: str) -> Optional[PaperTemplate]:
    return get_templates().get(template_id)

