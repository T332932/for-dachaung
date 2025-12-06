"""
任务管理服务：用于异步 AI 分析任务
"""
from __future__ import annotations
import uuid
import asyncio
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    progress: int = 0  # 0-100


class TaskManager:
    """
    内存任务管理器
    - 简单高效，适合单服务器部署
    - 服务重启会丢失任务状态（可接受，因为 AI 分析需要重试）
    """
    
    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._lock = threading.Lock()
    
    def create_task(self) -> str:
        """创建新任务，返回 task_id"""
        task_id = str(uuid.uuid4())
        task = Task(id=task_id)
        with self._lock:
            self._tasks[task_id] = task
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        with self._lock:
            return self._tasks.get(task_id)
    
    def update_status(self, task_id: str, status: TaskStatus, 
                      result: Dict[str, Any] = None, 
                      error: str = None,
                      progress: int = None):
        """更新任务状态"""
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                task.status = status
                task.updated_at = datetime.now(timezone.utc)
                if result is not None:
                    task.result = result
                if error is not None:
                    task.error = error
                if progress is not None:
                    task.progress = progress
    
    def cleanup_old_tasks(self, max_age_hours: int = 2):
        """清理超过指定时间的任务"""
        now = datetime.now(timezone.utc)
        with self._lock:
            old_ids = [
                tid for tid, task in self._tasks.items()
                if (now - task.created_at).total_seconds() > max_age_hours * 3600
            ]
            for tid in old_ids:
                del self._tasks[tid]


# 全局任务管理器实例
task_manager = TaskManager()
