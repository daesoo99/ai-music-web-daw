import { create } from 'zustand'
export interface BlockProgress {
  fraction: number
  stage: string
  isReady: boolean
}
export interface JobState {
  jobId: string
  prompt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
  blocks: Record<string, BlockProgress>
}
interface JobStoreState {
  jobs: Record<string, JobState>
  startJob: (jobId: string, prompt: string) => void
  updateBlockProgress: (
    jobId: string,
    blockId: string,
    fraction: number,
    stage: string,
  ) => void
  markBlockReady: (jobId: string, blockId: string) => void
  markJobComplete: (jobId: string) => void
  markJobFailed: (jobId: string, error: string) => void
  cancelJob: (jobId: string) => void
  dismissJob: (jobId: string) => void
}
const AUTO_DISMISS_DELAY_MS = 30_000
const MAX_JOB_COUNT = 20
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
const jobOrder: string[] = []
function cancelCleanupTimer(jobId: string): void {
  const timer = cleanupTimers.get(jobId)
  if (timer) {
    clearTimeout(timer)
    cleanupTimers.delete(jobId)
  }
}
function removeFromJobOrder(jobId: string): void {
  const index = jobOrder.indexOf(jobId)
  if (index !== -1) {
    jobOrder.splice(index, 1)
  }
}
function rememberJobOrder(jobId: string): void {
  removeFromJobOrder(jobId)
  jobOrder.push(jobId)
}
function syncJobOrder(jobs: Record<string, JobState>): void {
  const existingIds = new Set(Object.keys(jobs))
  for (let i = jobOrder.length - 1; i >= 0; i -= 1) {
    if (!existingIds.has(jobOrder[i])) {
      jobOrder.splice(i, 1)
    }
  }
  for (const jobId of existingIds) {
    if (!jobOrder.includes(jobId)) {
      jobOrder.push(jobId)
    }
  }
}
function isFinishedJob(job?: JobState): boolean {
  return job?.status === 'completed' || job?.status === 'failed'
}
function pruneJobsByLimit(
  jobs: Record<string, JobState>,
  protectedJobId?: string,
): Record<string, JobState> {
  const nextJobs = { ...jobs }
  syncJobOrder(nextJobs)
  while (Object.keys(nextJobs).length > MAX_JOB_COUNT) {
    const oldestFinishedJobId = jobOrder.find(
      jobId => jobId !== protectedJobId && isFinishedJob(nextJobs[jobId]),
    )
    const fallbackOldestJobId = jobOrder.find(
      jobId => jobId !== protectedJobId,
    )
    const removableJobId = oldestFinishedJobId ?? fallbackOldestJobId
    if (!removableJobId) {
      break
    }
    cancelCleanupTimer(removableJobId)
    delete nextJobs[removableJobId]
    removeFromJobOrder(removableJobId)
  }
  return nextJobs
}
export const useJobStore = create<JobStoreState>((set, get) => {
  const removeJob = (jobId: string): void => {
    cancelCleanupTimer(jobId)
    removeFromJobOrder(jobId)
    set((s) => {
      if (!s.jobs[jobId]) return s
      const nextJobs = { ...s.jobs }
      delete nextJobs[jobId]
      return { jobs: nextJobs }
    })
  }
  const scheduleAutoDismiss = (jobId: string): void => {
    cancelCleanupTimer(jobId)
    const timer = setTimeout(() => {
      removeJob(jobId)
    }, AUTO_DISMISS_DELAY_MS)
    cleanupTimers.set(jobId, timer)
  }
  return {
    jobs: {},
    startJob: (jobId, prompt) => {
      cancelCleanupTimer(jobId)
      rememberJobOrder(jobId)
      set((s) => {
        const nextJobs: Record<string, JobState> = {
          ...s.jobs,
          [jobId]: {
            jobId,
            prompt,
            status: 'running',
            blocks: {},
          },
        }
        return {
          jobs: pruneJobsByLimit(nextJobs, jobId),
        }
      })
    },
    updateBlockProgress: (jobId, blockId, fraction, stage) => {
      set((s) => {
        const job = s.jobs[jobId]
        if (!job) return s
        return {
          jobs: {
            ...s.jobs,
            [jobId]: {
              ...job,
              blocks: {
                ...job.blocks,
                [blockId]: {
                  ...job.blocks[blockId],
                  fraction,
                  stage,
                  isReady: job.blocks[blockId]?.isReady || false,
                },
              },
            },
          },
        }
      })
    },
    markBlockReady: (jobId, blockId) => {
      set((s) => {
        const job = s.jobs[jobId]
        if (!job) return s
        return {
          jobs: {
            ...s.jobs,
            [jobId]: {
              ...job,
              blocks: {
                ...job.blocks,
                [blockId]: {
                  ...job.blocks[blockId],
                  fraction: 1.0,
                  stage: 'ready',
                  isReady: true,
                },
              },
            },
          },
        }
      })
    },
    markJobComplete: (jobId) => {
      const job = get().jobs[jobId]
      if (!job) return
      set((s) => {
        const currentJob = s.jobs[jobId]
        if (!currentJob) return s
        return {
          jobs: {
            ...s.jobs,
            [jobId]: {
              ...currentJob,
              status: 'completed',
            },
          },
        }
      })
      scheduleAutoDismiss(jobId)
    },
    markJobFailed: (jobId, error) => {
      const job = get().jobs[jobId]
      if (!job) return
      set((s) => {
        const currentJob = s.jobs[jobId]
        if (!currentJob) return s
        return {
          jobs: {
            ...s.jobs,
            [jobId]: {
              ...currentJob,
              status: 'failed',
              error,
            },
          },
        }
      })
      scheduleAutoDismiss(jobId)
    },
    cancelJob: (jobId) => {
      set((s) => {
        const job = s.jobs[jobId]
        if (!job || job.status !== 'running') return s
        return {
          jobs: {
            ...s.jobs,
            [jobId]: { ...job, status: 'failed', error: '사용자가 취소했습니다. (※ GPU 작업은 백엔드에서 계속 진행되지만 결과는 무시됩니다. 새 요청 시 대기가 발생할 수 있습니다.)' },
          },
        }
      })
      scheduleAutoDismiss(jobId)
    },
    dismissJob: (jobId) => {
      removeJob(jobId)
    },
  }
})
