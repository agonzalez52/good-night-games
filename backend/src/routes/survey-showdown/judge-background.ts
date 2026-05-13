import { performance } from 'node:perf_hooks'

/**
 * In-process background jobs for the judge route.
 * Replace `defaultJudgeBackgroundQueue` with a real queue (e.g. BullMQ) when scaling beyond a single Node process.
 *
 * Contract:
 * - Serial execution (FIFO) so cache writes and AI calls stay ordered and tests stay deterministic.
 * - Structured `meta` is safe to log and is the seed for a future serializable job payload.
 * - `execute` holds closure state until a worker can reconstruct behavior from a stored payload.
 */

export type JudgeBackgroundJobKind = 'guest_ai' | 'authed_cache_persist'

export interface JudgeBackgroundJobMeta {
  gameId: string
  userId: string | null
  normalizedInput: string
  hiddenAnswerIds: readonly string[]
}

export interface JudgeBackgroundTask {
  kind: JudgeBackgroundJobKind
  meta: JudgeBackgroundJobMeta
  execute: () => Promise<void>
}

export interface JudgeBackgroundQueue {
  enqueue: (task: JudgeBackgroundTask) => void
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const logBackgroundEvent = (
  phase: 'start' | 'complete' | 'error',
  task: JudgeBackgroundTask,
  extra?: Record<string, unknown>
): void => {
  console.error(
    JSON.stringify({
      route: 'survey-showdown/judge-background',
      phase,
      kind: task.kind,
      gameId: task.meta.gameId,
      userId: task.meta.userId,
      normalizedInputLen: task.meta.normalizedInput.length,
      hiddenAnswerIdCount: task.meta.hiddenAnswerIds.length,
      ...extra,
    })
  )
}

const AUTHED_PERSIST_MAX_ATTEMPTS = 3
const AUTHED_PERSIST_BASE_DELAY_MS = 75

const runAuthedPersistWithRetries = async (task: JudgeBackgroundTask): Promise<void> => {
  let lastError: unknown
  for (let attempt = 1; attempt <= AUTHED_PERSIST_MAX_ATTEMPTS; attempt++) {
    try {
      await task.execute()
      return
    } catch (err) {
      lastError = err
      if (attempt === AUTHED_PERSIST_MAX_ATTEMPTS) break
      const backoffMs = AUTHED_PERSIST_BASE_DELAY_MS * attempt
      logBackgroundEvent('error', task, {
        retryAttempt: attempt,
        willRetryInMs: backoffMs,
        message: err instanceof Error ? err.message : String(err),
      })
      await sleep(backoffMs)
    }
  }
  throw lastError
}

const runSingleTask = async (task: JudgeBackgroundTask): Promise<void> => {
  const t0 = performance.now()
  logBackgroundEvent('start', task)
  try {
    if (task.kind === 'authed_cache_persist') await runAuthedPersistWithRetries(task)
    else await task.execute()

    logBackgroundEvent('complete', task, { durationMs: Number((performance.now() - t0).toFixed(2)) })
  } catch (err) {
    logBackgroundEvent('error', task, {
      durationMs: Number((performance.now() - t0).toFixed(2)),
      message: err instanceof Error ? err.message : String(err),
    })
    if (task.kind === 'guest_ai') throw err
    console.error('Judge authed cache persist background job failed after retries:', err)
  }
}

let jobChain: Promise<void> = Promise.resolve()

const enqueueOnChain = (task: JudgeBackgroundTask): void => {
  setImmediate(() => {
    jobChain = jobChain
      .then(async () => {
        await runSingleTask(task)
      })
      .catch(err => {
        console.error('Judge background chain error (non-fatal):', err)
      })
  })
}

const defaultJudgeBackgroundQueue: JudgeBackgroundQueue = {
  enqueue: (task: JudgeBackgroundTask): void => {
    enqueueOnChain(task)
  },
}

let activeQueue: JudgeBackgroundQueue = defaultJudgeBackgroundQueue

export { defaultJudgeBackgroundQueue }

export const setJudgeBackgroundQueueForTests = (queue: JudgeBackgroundQueue | null): void => {
  activeQueue = queue ?? defaultJudgeBackgroundQueue
}

/** @internal Resets the in-process promise chain between tests. */
export const resetJudgeBackgroundJobChainForTests = (): void => {
  jobChain = Promise.resolve()
}

/**
 * Enqueue a judge background task (guest AI follow-up or deferred authed cache write).
 */
export const enqueueJudgeBackgroundJob = (task: JudgeBackgroundTask): void => {
  activeQueue.enqueue(task)
}

/**
 * Await all scheduled background tasks on the in-process chain.
 * Prefer {@link flushJudgeBackgroundJobsForTests} in route tests so deferred enqueue runs first.
 */
export const awaitJudgeBackgroundJobsForTests = (): Promise<void> => jobChain

/**
 * Wait for the next `setImmediate` tick (so deferred enqueue runs), then await the job chain.
 * Use in Vitest after a judge request that schedules background work.
 */
export const flushJudgeBackgroundJobsForTests = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    setImmediate(resolve)
  })
  await awaitJudgeBackgroundJobsForTests()
}
