import { INFO_SCOPE, TASK_MODES, TASK_RESUME, TASK_STAGES } from './config.js'
import { meta, updateMeta, assertCounts } from './storage.js'

// Raised when an unfinished task already exists: the caller decides whether to
// resume it or to restart it explicitly.
class TaskConflictError extends Error {
    constructor(message, task) {
        super(message)
        this.name = 'TaskConflictError'
        this.code = 'TASK_UNFINISHED'
        this.task = task || null
    }
}

export const TASK_STATUS = {
    MISSING_META: 'missing_meta',
    NO_TASK: 'no_task',
    UNFINISHED: 'unfinished',
    COMPLETED: 'completed',
}

export function infoScopeFor(targetUsername, authUsername) {
    return authUsername && authUsername === targetUsername
        ? INFO_SCOPE.PRIVATE
        : INFO_SCOPE.PUBLIC
}

function newTaskId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

function checkStage(stage) {
    if (!TASK_STAGES.includes(stage)) throw new Error('未知任务阶段')
}

// `position` is only a stage-local counter shown for diagnostics; resume never
// reads it, because it relies on `stage` plus the `done_ids` subject set.
function checkPosition(position) {
    if (!Number.isInteger(position) || position < 0) throw new Error('任务位置必须为非负整数')
}

function checkDoneSubjectId(subjectId) {
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
        throw new Error('已完成条目的 subject_id 类型无效')
    }
}

// `resume` reads the unfinished task stored under the target username, so each
// target keeps its own checkpoint.
export async function beginTask(username, operation, { authUsername = '', stage, restart = false } = {}) {
    if (operation === TASK_RESUME) {
        if (stage !== undefined) checkStage(stage)
        return updateMeta(username, record => {
            if (!record) throw new Error('没有该用户的资料')
            const task = record.task
            if (!task) throw new Error('没有可续传的任务')
            if (!task.incomplete) throw new Error('该任务已完成')
            if ((task.auth_username || '') !== (authUsername || '')) {
                throw new Error('授权身份与任务记录不一致，不能续传')
            }
            return { record, value: task }
        })
    }
    if (!TASK_MODES.includes(operation)) throw new Error('未知任务类型')
    const nextStage = stage ?? TASK_STAGES[0]
    checkStage(nextStage)

    return updateMeta(username, record => {
        if (!record) throw new Error('没有该用户的资料')
        if (record.task?.incomplete && !restart) throw new TaskConflictError('已有未完成任务', record.task)
        record.task = {
            task_id: newTaskId(),
            mode: operation,
            info_scope: infoScopeFor(username, authUsername),
            auth_username: authUsername || '',
            stage: nextStage,
            position: 0,
            done_ids: [],
            progress: { done: 0, total: 0 },
            incomplete: true,
            updated_at: Date.now(),
        }
        return { record, value: record.task }
    })
}

export async function advanceTask(username, taskId, {
    stage, position, progress, doneSubjectId,
} = {}) {
    if (!taskId) throw new Error('缺少任务令牌')
    if (stage !== undefined) checkStage(stage)
    if (position !== undefined) checkPosition(position)
    if (doneSubjectId !== undefined) checkDoneSubjectId(doneSubjectId)
    if (progress !== undefined
        && (!progress || typeof progress !== 'object' || Array.isArray(progress))) {
        throw new Error('任务进度格式错误')
    }

    return updateMeta(username, record => {
        const task = record?.task
        if (!task || task.task_id !== taskId || !task.incomplete) {
            return { record: null, value: null }
        }
        if (stage !== undefined && stage !== task.stage) {
            task.stage = stage
            task.position = position ?? 0
            // Records are completed per subject_id inside the current stage;
            // a new stage starts with an empty set so list reordering is safe.
            task.done_ids = []
        } else if (position !== undefined) {
            task.position = position
        }
        if (doneSubjectId !== undefined) {
            if (!Array.isArray(task.done_ids)) task.done_ids = []
            if (!task.done_ids.includes(doneSubjectId)) task.done_ids.push(doneSubjectId)
        }
        if (progress) {
            const next = { ...(task.progress || {}), ...progress }
            assertCounts(next, '任务进度')
            task.progress = next
        }
        task.updated_at = Date.now()
        return { record, value: task }
    })
}

export async function finishTask(username, taskId) {
    if (!taskId) throw new Error('缺少任务令牌')
    return updateMeta(username, record => {
        const task = record?.task
        if (!task || task.task_id !== taskId || !task.incomplete) {
            return { record: null, value: null }
        }
        task.incomplete = false
        task.updated_at = Date.now()
        return { record, value: task }
    })
}

// Drops a checkpoint for one target so a full or incremental backup can start
// with another credential. Only the task is removed; cached items stay.
export async function discardTask(username) {
    return updateMeta(username, record => {
        if (!record?.task) return { record: null, value: false }
        record.task = null
        record.updated_at = Date.now()
        return { record, value: true }
    })
}

export async function getTask(username, { includeCompleted = false } = {}) {
    const record = await meta.get(username)
    if (!record) return { status: TASK_STATUS.MISSING_META, task: null }
    if (!record.task) return { status: TASK_STATUS.NO_TASK, task: null }
    if (record.task.incomplete) return { status: TASK_STATUS.UNFINISHED, task: record.task }
    return {
        status: TASK_STATUS.COMPLETED,
        task: includeCompleted ? record.task : null,
    }
}
