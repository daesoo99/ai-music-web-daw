import { useJobStore } from '../store/useJobStore'

function ensureTrackRegistered(trackId: string): void {
  const projectStore = useProjectStore.getState()
  const exists = projectStore.tracks.some(t => t.trackId === trackId)
  if (exists) return

  const instrumentInfoMap: Record<string, { name: string; icon: string }> = {
    piano: { name: 'Grand Piano', icon: '🎹' },
    strings: { name: 'Strings Ensemble', icon: '🎻' },
    drums: { name: 'Acoustic Drums', icon: '🥁' },
    bass: { name: 'Bass Guitar', icon: '🎸' },
    saxophone: { name: 'Saxophone', icon: '🎷' },
    sax: { name: 'Saxophone', icon: '🎷' },
    synth: { name: 'Synthesizer', icon: '🎹' },
    guitar: { name: 'Electric Guitar', icon: '🎸' },
    vocal: { name: 'Vocals', icon: '🎤' },
    trumpet: { name: 'Trumpet', icon: '🎺' },
    flute: { name: 'Flute', icon: '🎶' }
  }

  const info = instrumentInfoMap[trackId.toLowerCase()] ?? {
    name: trackId.charAt(0).toUpperCase() + trackId.slice(1) + ' Track',
    icon: '🎵'
  }

  const updatedTracks = [
    ...projectStore.tracks,
    { trackId, name: info.name, icon: info.icon }
  ]
  projectStore.setProject(updatedTracks, projectStore.blocks, 'Add Track ' + info.name)
}


import { useProjectStore } from '../store/useProjectStore'

import type { TimelineBlock } from '../types/audio'

interface WsConnectionState {

  ws: WebSocket | null

  projectId: string

  attemptCount: number

  manuallyClosed: boolean

  reconnectTimer: ReturnType<typeof setTimeout> | null

  isReconnectScheduled: boolean

}

class WsClient {

  private connections = new Map<string, WsConnectionState>()

  private readonly maxAttempts = 5

  private readonly baseReconnectDelayMs = 1000

  private readonly maxReconnectDelayMs = 10000

  subscribe(jobId: string, projectId: string) {

    const existing = this.connections.get(jobId)

    if (existing && !existing.manuallyClosed) {

      return

    }

    const connectionState: WsConnectionState = {

      ws: null,

      projectId,

      attemptCount: 0,

      manuallyClosed: false,

      reconnectTimer: null,

      isReconnectScheduled: false,

    }

    this.connections.set(jobId, connectionState)

    this.connect(jobId, connectionState)

  }

  close(jobId: string) {

    const connectionState = this.connections.get(jobId)

    if (!connectionState) return

    connectionState.manuallyClosed = true

    if (connectionState.reconnectTimer) {

      clearTimeout(connectionState.reconnectTimer)

      connectionState.reconnectTimer = null

    }

    const ws = connectionState.ws

    connectionState.ws = null

    if (

      ws &&

      ws.readyState !== WebSocket.CLOSED &&

      ws.readyState !== WebSocket.CLOSING

    ) {

      ws.close()

    }

    this.connections.delete(jobId)

  }

  private connect(jobId: string, connectionState: WsConnectionState) {

    if (connectionState.manuallyClosed) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    const url = `${protocol}//${window.location.host}/api/ws/progress?job_id=${encodeURIComponent(jobId)}`

    const ws = new WebSocket(url)

    connectionState.ws = ws

    connectionState.isReconnectScheduled = false

    ws.onopen = () => {

      const latestState = this.connections.get(jobId)

      if (!latestState || latestState.ws !== ws) return

      latestState.attemptCount = 0

    }

    ws.onmessage = async (event) => {

      await this.handleMessage(event, jobId, connectionState.projectId)

    }

    ws.onerror = () => {

      this.handleUnexpectedDisconnect(

        jobId,

        ws,

        'WebSocket connection error',

      )

    }

    ws.onclose = () => {

      this.handleUnexpectedDisconnect(

        jobId,

        ws,

        'WebSocket connection closed',

      )

    }

  }

  private handleUnexpectedDisconnect(

    jobId: string,

    ws: WebSocket,

    reason: string,

  ) {

    const connectionState = this.connections.get(jobId)

    if (!connectionState) return

    if (connectionState.manuallyClosed) return

    if (connectionState.ws !== ws) return

    if (connectionState.isReconnectScheduled) return

    connectionState.ws = null

    if (

      ws.readyState !== WebSocket.CLOSED &&

      ws.readyState !== WebSocket.CLOSING

    ) {

      ws.close()

    }

    if (connectionState.attemptCount >= this.maxAttempts) {

      useJobStore

        .getState()

        .markJobFailed(

          jobId,

          `${reason}. 재연결 시도 ${this.maxAttempts}회 실패`,

        )

      this.cleanup(jobId)

      return

    }

    const delayMs = Math.min(

      this.maxReconnectDelayMs,

      this.baseReconnectDelayMs * Math.pow(2, connectionState.attemptCount),

    )

    connectionState.attemptCount += 1

    connectionState.isReconnectScheduled = true

    connectionState.reconnectTimer = setTimeout(() => {

      const latestState = this.connections.get(jobId)

      if (!latestState) return

      if (latestState.manuallyClosed) return

      latestState.reconnectTimer = null

      latestState.isReconnectScheduled = false

      this.connect(jobId, latestState)

    }, delayMs)

  }

  private cleanup(jobId: string) {

    const connectionState = this.connections.get(jobId)

    if (!connectionState) return

    connectionState.manuallyClosed = true

    if (connectionState.reconnectTimer) {

      clearTimeout(connectionState.reconnectTimer)

      connectionState.reconnectTimer = null

    }

    const ws = connectionState.ws

    connectionState.ws = null

    if (

      ws &&

      ws.readyState !== WebSocket.CLOSED &&

      ws.readyState !== WebSocket.CLOSING

    ) {

      ws.close()

    }

    this.connections.delete(jobId)

  }

  private async handleMessage(

    event: MessageEvent,

    jobId: string,

    projectId: string,

  ) {

    try {

      const data = JSON.parse(event.data)

      const jobStore = useJobStore.getState()

      const projectStore = useProjectStore.getState()

      switch (data.type) {

        case 'block_progress': {

          const progressBlockId = data.block_id || 'unknown'

          const fraction = data.progress ?? data.fraction ?? 0

          const stage = data.stage || 'rendering'

          jobStore.updateBlockProgress(

            jobId,

            progressBlockId,

            fraction,

            stage,

          )

          break

        }

        case 'block_complete': {

          const blockMeta = data.block || {}

          const blockId = data.block_id || blockMeta.block_id

          jobStore.markBlockReady(jobId, blockId)

          const trackId = blockMeta.track_id || 'piano'
          ensureTrackRegistered(trackId)

          const duration = blockMeta.duration || 30.0

          const audioUrl = blockMeta.audio_path

            ? blockMeta.audio_path

            : `/api/audio/projects/${projectId}/blocks/${blockId}.mp3`

          // Repaint 결과인지 판단 (block_meta에 source_block_id가 있으면)

          const isRepaint = !!blockMeta.source_block_id

          if (isRepaint) {

            // 원본 블록은 유지 (비활성화하지 않음)

            // 새 블록을 백엔드가 지정한 trackId에 추가 (재편곡 변주)

            const originalBlock = projectStore.blocks.find(b => b.blockId === blockMeta.source_block_id)

            const newBlock: TimelineBlock = {

              blockId,

              trackId,

              audioUrl,

              timelineStartSeconds: originalBlock?.timelineStartSeconds ?? blockMeta.timelineStartSeconds ?? 0,

              durationSeconds: duration,

              prompt: blockMeta.prompt,

              isRepaintOf: blockMeta.source_block_id,

              isActive: true,

            }

            projectStore.addBlock(newBlock)

          } else {

            // 기존 신규 생성 로직

            const newBlock: TimelineBlock = {

              blockId,

              trackId,

              audioUrl,

              timelineStartSeconds:

                blockMeta.timelineStartSeconds !== undefined

                  ? blockMeta.timelineStartSeconds

                  : projectStore.blocks

                      .filter(b => b.trackId === trackId)

                      .reduce(

                        (max, b) =>

                          Math.max(

                            max,

                            b.timelineStartSeconds + b.durationSeconds,

                          ),

                        0,

                      ),

              durationSeconds: duration,

              prompt: blockMeta.prompt,

              isActive: true, // 신규 생성 시 기본 true

            }

            projectStore.addBlock(newBlock)

          }

          break

        }

        case 'job_complete':

          jobStore.markJobComplete(jobId)

          this.close(jobId)

          break

        case 'job_failed':

          jobStore.markJobFailed(jobId, data.error || 'Unknown error')

          this.close(jobId)

          break

        case 'midi_status':

        case 'midi_ready': {

          const { useNotesStore } = await import('../store/useNotesStore')

          useNotesStore

            .getState()

            .applyWsUpdate(data.block_id, data.status || 'ready')

          break

        }

      }

    } catch (err) {

      console.error('Failed to parse WS message:', err)

    }

  }

}

export const wsClient = new WsClient()

