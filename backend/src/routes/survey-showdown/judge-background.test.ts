import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueueJudgeBackgroundJob,
  flushJudgeBackgroundJobsForTests,
  resetJudgeBackgroundJobChainForTests,
  setJudgeBackgroundQueueForTests,
} from './judge-background'

const sampleMeta = {
  gameId: 'survey_showdown',
  userId: null as string | null,
  normalizedInput: 'x',
  hiddenAnswerIds: [] as const,
}

describe('judge-background', () => {
  beforeEach(() => {
    resetJudgeBackgroundJobChainForTests()
    setJudgeBackgroundQueueForTests(null)
  })

  it('runs enqueued jobs in FIFO order on the shared chain', async () => {
    const order: number[] = []
    enqueueJudgeBackgroundJob({
      kind: 'guest_ai',
      meta: sampleMeta,
      execute: async () => {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 5)
        })
        order.push(1)
      },
    })
    enqueueJudgeBackgroundJob({
      kind: 'guest_ai',
      meta: { ...sampleMeta, normalizedInput: 'y' },
      execute: async () => {
        order.push(2)
      },
    })

    await flushJudgeBackgroundJobsForTests()
    expect(order).toEqual([1, 2])
  })

  it('routes enqueue through an injected queue implementation', async () => {
    const customEnqueue = vi.fn()
    setJudgeBackgroundQueueForTests({
      enqueue: task => {
        customEnqueue(task.meta.normalizedInput)
        void task.execute()
      },
    })

    enqueueJudgeBackgroundJob({
      kind: 'guest_ai',
      meta: { ...sampleMeta, normalizedInput: 'injected' },
      execute: async () => {},
    })

    await flushJudgeBackgroundJobsForTests()
    expect(customEnqueue).toHaveBeenCalledTimes(1)
    expect(customEnqueue).toHaveBeenCalledWith('injected')
  })
})
