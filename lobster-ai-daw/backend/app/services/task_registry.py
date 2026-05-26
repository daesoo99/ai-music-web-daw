import asyncio

_running_tasks: dict[str, asyncio.Task] = {}

def spawn_job(job_id: str, coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _running_tasks[job_id] = task
    task.add_done_callback(lambda t: _running_tasks.pop(job_id, None))
    return task

def cancel_job(job_id: str) -> bool:
    task = _running_tasks.get(job_id)
    if task:
        task.cancel()
        return True
    return False
