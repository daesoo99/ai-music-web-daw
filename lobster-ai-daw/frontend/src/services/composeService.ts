export interface SequenceSpec {
  prompt: string
  duration_seconds: number
  track_id: string
  previous_block_id?: string
  start_time?: number | null
}

export interface JobAccepted {
  job_id: string
  block_count?: number
  ws_url?: string
}

export class ComposeServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'ComposeServiceError'
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ComposeServiceError(
      `?쒕쾭 ?묐떟 ?ㅻ쪟 (${res.status}): ${text || res.statusText}`,
      res.status,
    )
  }
  return res.json() as Promise<T>
}

export async function composeSequence(params: {
  projectId: string
  specs: SequenceSpec[]
}): Promise<JobAccepted> {
  return postJson<JobAccepted>('/api/blocks/sequence', {
    project_id: params.projectId,
    specs: params.specs,
  })
}

export async function repaintSegment(params: {
  projectId: string
  sourceBlockId: string
  trackId: string
  startSeconds: number
  endSeconds: number
  newPrompt: string
}): Promise<JobAccepted> {
  return postJson<JobAccepted>('/api/blocks/repaint', {
    project_id: params.projectId,
    source_block_id: params.sourceBlockId,
    track_id: params.trackId,
    start_seconds: params.startSeconds,
    end_seconds: params.endSeconds,
    new_prompt: params.newPrompt,
  })
}
