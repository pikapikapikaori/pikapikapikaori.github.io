import { infoScopes, taskModes, taskResume, taskStages } from './config.js'
import { meta, updateMeta, assertCounts } from './storage.js'

class TaskConflictError extends Error {
    constructor(message, task) {
        super(message)
        this.name = 'TaskConflictError'
        this.code = 'TASK_UNFINISHED'
        this.task = task || null
    }
}

export const taskStatus = {
    missingMeta: 'missing_meta',
    noTask: 'no_task',
    unfinished: 'unfinished',
    completed: 'completed',
}

export function infoScopeFor(targetUsername, authUsername) {
    return authUsername && authUsername === targetUsername
        ? infoScopes.private
        : infoScopes.public
}

function newTaskId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

function checkStage(stage) {
    if (!taskStages.includes(stage)) throw new Error('未知任务阶段')
}

function checkPosition(position) {
    if (!Number.isInteger(position) || position < 0) throw new Error('任务位置必须为非负整数')
}

function checkDoneSubjectId(subjectId) {
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
        throw new Error('已完成条目的 subject_id 类型无效')
    }
}

function checkCollectionTotal(total) {
    if (!Number.isInteger(total) || total < 0) {
        throw new Error('收藏列表总数必须为非负整数')
    }
}

export async function beginTask(username, operation, { authUsername = '', stage, restart = false } = {}) {
    if (operation === taskResume) {
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
    if (!taskModes.includes(operation)) throw new Error('未知任务类型')
    const nextStage = stage ?? taskStages[0]
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
            done_count: 0,
            progress: { done: 0, total: 0 },
            incomplete: true,
            updated_at: Date.now(),
        }
        return { record, value: record.task }
    })
}

export async function advanceTask(username, taskId, {
    stage, position, progress, doneSubjectId, collectionTotal,
} = {}) {
    if (!taskId) throw new Error('缺少任务令牌')
    if (stage !== undefined) checkStage(stage)
    if (position !== undefined) checkPosition(position)
    if (doneSubjectId !== undefined) checkDoneSubjectId(doneSubjectId)
    if (collectionTotal !== undefined) checkCollectionTotal(collectionTotal)
    if (progress !== undefined
        && (!progress || typeof progress !== 'object' || Array.isArray(progress))) {
        throw new Error('任务进度格式错误')
    }

    return updateMeta(username, (record, ctx) => {
        const task = record?.task
        if (!task || task.task_id !== taskId || !task.incomplete) {
            return { record: null, value: null }
        }
        if (stage !== undefined && stage !== task.stage) {
            task.stage = stage
            task.position = position ?? 0
            ctx.resetDone()
        } else if (position !== undefined) {
            task.position = position
        }
        if (doneSubjectId !== undefined) ctx.appendDone(doneSubjectId)
        if (collectionTotal !== undefined) task.collection_total = collectionTotal
        if (progress) {
            const next = { ...(task.progress || {}), ...progress }
            assertCounts(next, '任务进度')
            task.progress = next
        }
        task.updated_at = Date.now()
        return { record, value: task }
    })
}

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
    if (!record) return { status: taskStatus.missingMeta, task: null }
    if (!record.task) return { status: taskStatus.noTask, task: null }
    if (record.task.incomplete) return { status: taskStatus.unfinished, task: record.task }
    return {
        status: taskStatus.completed,
        task: includeCompleted ? record.task : null,
    }
}
