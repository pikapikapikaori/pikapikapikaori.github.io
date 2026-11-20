// Full, incremental and resumed backups over the shared item store.
// The run freezes the target, the authorized account, the information scope
// and the task token when it starts; later UI edits cannot change them.
import {
    bgmDataUrl, infoScopes, retryWaitMs, taskModes, taskResume, taskStage, taskStages,
} from '../config.js'
import { finalizeBackup, items, meta, taskDone, taskList } from '../storage.js'
import {
    advanceTask, beginTask, infoScopeFor,
} from '../tasks.js'
import {
    BangumiApi, abortError, createBgmSource, createStaticStats, fetchEpisodeData, isAbortError,
    normalizeRequestSettings,
} from './api.js'
import { refreshAccessToken, requireAccessToken } from './auth.js'

const runModes = taskModes.concat(taskResume)

// Checkpoints are keyed by subject_id, not by list index: a resumed task keeps
// its saved collection list, whose order may differ from a fresh fetch. The ids
// of the current stage are read back chunk by chunk.
function readDoneIds(task) {
    return taskDone.read(task.task_id, task.stage)
}

function mergeStaticStats(target, source) {
    if (!source) return target
    for (const key of Object.keys(target)) {
        const value = Number(source[key])
        if (Number.isFinite(value) && value > 0) target[key] += value
    }
    return target
}

function staticBroken(stats) {
    if (!stats) return false
    return (stats.manifest_failures || 0) + (stats.chunk_failures || 0) + (stats.parse_failures || 0) > 0
}

// Detail and episodes are confirmed again from the shard snapshot or the API in
// every task, so a stored detail never decides what is fetched. A stored
// progress is reused only while the collection state it was read from is still
// the current one: the list record carries that version as `progress_at`,
// because the progress itself lives in the item's detail record and is not read
// here.
function planItems(list, stored, mode, infoScope) {
    const storedById = new Map()
    for (const record of stored) storedById.set(record.subject_id, record)

    const planned = list.map(entry => ({ ...entry }))
    const needsProgress = new Set()
    if (infoScope !== infoScopes.private) return { items: planned, needsProgress }
    for (const item of planned) {
        const prior = storedById.get(item.subject_id)
        const reusable = !!prior
            && prior.updated_at === item.updated_at
            && prior.progress_at === item.updated_at
        if (mode === 'full' || !reusable) needsProgress.add(item.subject_id)
    }
    return { items: planned, needsProgress }
}

async function ensureUserRecord(username) {
    const existing = await meta.get(username)
    if (existing) return existing
    const record = {
        username,
        user: { username },
        generated_at: 0,
        updated_at: Date.now(),
        completeness: { total: 0, done: 0 },
        task: null,
    }
    await meta.put(record)
    return record
}

function createRun(options, signal) {
    const target = String(options.username || '').trim()
    const authUsername = String(options.authUsername || '').trim()
    const mode = options.mode
    const infoScope = infoScopeFor(target, authUsername)
    const settings = normalizeRequestSettings(options)
    const restart = options.restart === true
    const stageHook = options.onStage || null
    const progressHook = options.onProgress || null
    const logHook = options.onLog || null

    function log(message, type = 'info') {
        logHook?.(message, type)
    }

    function stage(name, total) {
        stageHook?.(name, total)
    }

    function progress(done) {
        progressHook?.(done)
    }

    const bgm = createBgmSource({
        base: String(options.bgmBase || bgmDataUrl),
        signal,
        onStage: stage,
        onProgress: progress,
        onLog: log,
    })

    let api = null
    let taskId = ''
    let activeMode = mode
    let plan = null
    let cachedRecords = []
    let collectionComplete = false
    let collectionTotal = 0
    const staticStats = { subject: createStaticStats(), episode: createStaticStats() }
    const issues = { progress_bad_response: 0, progress_not_found: 0, episode_skip_types: 0 }

    function requireTask(task) {
        if (!task) throw new Error('任务记录已变更，本次执行中止')
        return task
    }

    async function openTask() {
        if (mode === taskResume) {
            const task = await beginTask(target, taskResume, { authUsername })
            if (task.info_scope !== infoScope) {
                throw new Error('任务记录的信息范围与当前授权不一致，不能继续')
            }
            if (!taskModes.includes(task.mode)) throw new Error('任务记录的模式无效')
            return task
        }
        // Never discard an unfinished checkpoint unless the caller explicitly
        // passes `restart: true` after the user confirmed it.
        return beginTask(target, mode, { authUsername, restart })
    }

    // The stored record is read and merged inside one read-write transaction,
    // together with the task token check, so an import or cache clear during
    // the run cannot be overwritten with data from an earlier point.
    async function saveItem(item) {
        const written = await items.merge(target, item, { infoScope, taskId })
        if (!written) throw new Error('任务记录已变更，本次执行中止')
    }

    async function enterStage(stageName) {
        const task = await advanceTask(target, taskId, {
            stage: stageName,
            position: 0,
            progress: { done: 0, total: 0 },
        })
        requireTask(task)
    }

    async function checkpoint(done, stageName, total, subjectId) {
        const task = await advanceTask(target, taskId, {
            stage: stageName,
            position: done,
            progress: { done, total },
            doneSubjectId: subjectId,
        })
        requireTask(task)
    }

    // The list is fetched once per task and saved page by page, so only an
    // unfinished list stage may still page. A later stage always reads the saved
    // entries: the collection API is not asked again.
    async function fetchCollections(task) {
        let total = task.collection_total
        let list = []
        const pages = await taskList.read(taskId)
        for (const page of pages) {
            if (page.offset !== list.length) {
                throw new Error(`收藏列表断点分页不连续: ${page.offset}/${list.length}`)
            }
            list = list.concat(page.items)
        }
        if (Number.isInteger(total) && list.length > total) {
            throw new Error(`收藏列表条数异常: ${list.length}/${total}`)
        }
        if (task.stage !== taskStage.collections) {
            if (!Number.isInteger(total)) throw new Error('任务缺少收藏列表总数')
            if (list.length !== total) throw new Error(`收藏列表断点不完整: ${list.length}/${total}`)
            log(`收藏列表沿用任务记录: ${list.length} 条`, 'info')
            collectionComplete = true
            collectionTotal = total
            return list
        }

        const limit = 30

        // The page is stored before the checkpoint names it: a crash between the
        // two writes then only repeats work, never loses a page. An empty page
        // stores nothing: a page holds entries and the stored total of 0 already
        // says the list is complete.
        async function savePage(pageTotal, pageItems, nextList) {
            if (pageItems.length) {
                const written = await taskList.put(target, taskId,
                    nextList.length - pageItems.length, pageItems)
                if (!written) throw new Error('任务记录已变更，本次执行中止')
            }
            requireTask(await advanceTask(target, taskId, {
                stage: taskStage.collections,
                collectionTotal: pageTotal,
                position: nextList.length,
                progress: { done: nextList.length, total: pageTotal },
            }))
        }

        if (!Number.isInteger(total)) {
            stage('拉取收藏列表', 0)
            const first = await api.getUserCollectionsPage(target, 0, limit)
            if (!first || !Array.isArray(first.data) || !Number.isInteger(first.total)) {
                throw new Error('收藏列表响应异常: ' + JSON.stringify(first).slice(0, 200))
            }
            total = first.total
            list = first.data.slice()
            if (list.length > total) {
                throw new Error(`收藏列表条数异常: ${list.length}/${total}`)
            }
            await savePage(total, list, list)
            stage('拉取收藏列表', total)
            progress(list.length)
        } else if (list.length < total) {
            stage('拉取收藏列表', total)
            log(`收藏列表断点: ${list.length}/${total} 条`, 'warn')
            progress(list.length)
        } else {
            log(`收藏列表已完整: ${list.length} 条`, 'info')
        }

        while (list.length < total) {
            if (signal.aborted) throw abortError()
            const offset = list.length
            const page = await api.getUserCollectionsPage(target, offset, limit)
            if (!page || !Array.isArray(page.data)) {
                throw new Error('收藏列表分页响应异常: ' + JSON.stringify(page).slice(0, 200))
            }
            if (!page.data.length) {
                throw new Error(`收藏列表分页为空，已取 ${list.length}/${total}`)
            }
            const next = list.concat(page.data)
            if (next.length <= offset) {
                throw new Error(`收藏列表分页未增长，已取 ${next.length}/${total}`)
            }
            if (next.length > total) {
                throw new Error(`收藏列表条数异常: ${next.length}/${total}`)
            }
            list = next
            await savePage(total, page.data, list)
            progress(list.length)
        }
        if (list.length !== total) {
            throw new Error(`收藏列表不完整: ${list.length}/${total}`)
        }
        const seen = new Set()
        for (const entry of list) {
            const subjectId = entry?.subject_id
            if (!Number.isInteger(subjectId) || subjectId <= 0) {
                throw new Error(`收藏列表 subject_id 类型无效: ${String(subjectId)}`)
            }
            if (seen.has(subjectId)) {
                throw new Error(`收藏列表 subject_id 不唯一: ${subjectId}`)
            }
            seen.add(subjectId)
        }
        collectionComplete = true
        collectionTotal = total
        log(`收藏列表: ${list.length} 条`, 'success')
        return list
    }

    // A static snapshot is a cache, not a requirement: broken manifests and
    // chunks are counted and reported, and the API fallback continues.
    async function loadStatic(kind, pending, options) {
        const stats = kind === 'subject' ? staticStats.subject : staticStats.episode
        const label = kind === 'subject' ? '条目' : '分集'
        try {
            const result = kind === 'subject'
                ? await bgm.fillSubjects(pending, options)
                : await bgm.fillEpisodes(pending)
            mergeStaticStats(stats, result?.stats)
            if (result?.filled > 0) {
                log(kind === 'subject'
                    ? `静态数据命中条目 ${result.filled} 条`
                    : `静态分集数据命中 ${result.filled} 条`, 'success')
            }
            if (staticBroken(result?.stats)) {
                const broken = result.stats
                log(`静态${label}数据不完整：分片失败 ${broken.chunk_failures} · 解析失败 ${broken.parse_failures} · 清单读取失败 ${broken.manifest_failures}`, 'warn')
            }
        } catch (error) {
            if (isAbortError(error)) throw abortError()
            stats.manifest_failures += 1
            log(`静态${label}数据不可用: ${error.message}`, 'warn')
        }
    }

    async function runSubjects(doneIds) {
        const todo = plan.items.filter(item => !doneIds.has(item.subject_id))
        if (!todo.length) return
        // The snapshot is read first in every mode; the API covers only the
        // subjects it does not hold.
        await loadStatic('subject', todo)

        // The saved done set and the remaining work together keep the stage
        // counter continuous across a stop, even when completed items are not
        // in `todo`.
        const total = doneIds.size + todo.length
        let done = doneIds.size
        stage('拉取条目', total)
        progress(done)
        for (const item of todo) {
            if (signal.aborted) throw abortError()
            if (item.subject_data == null) item.subject_data = await api.getSubject(item.subject_id)
            await saveItem(item)
            done += 1
            progress(done)
            await checkpoint(done, taskStage.subjects, total, item.subject_id)
        }
    }

    async function runEpisodes(doneIds) {
        const todo = plan.items.filter(item => !doneIds.has(item.subject_id))
        if (!todo.length) return
        // The episode check compares the snapshot's episode count with the
        // subject's `eps`; a resumed task has no detail in memory, so the
        // subject snapshot is read again for those items. That read answers
        // only `eps`, so a subject the snapshot lacks is not a coverage gap
        // here, and the stored detail is never read for it.
        const noDetail = todo.filter(item => item.subject_data == null)
        if (noDetail.length) await loadStatic('subject', noDetail, { countMiss: false })
        await loadStatic('episode', todo)

        const total = doneIds.size + todo.length
        let done = doneIds.size
        stage('拉取分集', total)
        progress(done)
        for (const item of todo) {
            if (signal.aborted) throw abortError()
            if (item.ep_data == null) {
                item.ep_data = await fetchEpisodeData(api, item.subject_id, {
                    onSkip: type => {
                        issues.episode_skip_types += 1
                        log(`跳过不支持的 episode type=${type}`, 'warn')
                    },
                })
            }
            await saveItem(item)
            done += 1
            progress(done)
            await checkpoint(done, taskStage.episodes, total, item.subject_id)
        }
    }

    // A 200 body of `null` means the endpoint explicitly reported no progress;
    // a 404 cannot prove that, so it is treated as not obtained.
    async function readProgress(subjectId) {
        let data
        try {
            data = await api.getUserProgress(target, subjectId)
        } catch (error) {
            if (isAbortError(error)) throw error
            if (error.status === 404) return { ok: false, status: 404 }
            throw error
        }
        if (data && data.code === 401 && data.error) {
            const error = new Error('访问令牌无效或已过期，请重新登录')
            error.status = 401
            throw error
        }
        // Only an explicit "no progress" or an eps array may be written; any
        // other shape stays unfetched so a later run can ask again.
        if (data == null) return { ok: true, progress: { eps: [] } }
        if (Array.isArray(data)) return { ok: true, progress: { eps: data } }
        if (data && typeof data === 'object' && Array.isArray(data.eps)) {
            return { ok: true, progress: data }
        }
        return { ok: false, data }
    }

    async function runProgress(doneIds) {
        if (infoScope !== infoScopes.private) {
            log('公开数据不拉取逐集进度', 'info')
            return
        }
        const pending = plan.items.filter(item => plan.needsProgress.has(item.subject_id))
        if (!pending.length) return
        const todo = pending.filter(item => !doneIds.has(item.subject_id))
        if (!todo.length) return
        const total = doneIds.size + todo.length
        let done = doneIds.size
        stage('拉取观看进度', total)
        progress(done)
        for (const item of todo) {
            if (signal.aborted) throw abortError()
            const outcome = await readProgress(item.subject_id)
            if (outcome.ok) {
                item.progress = outcome.progress
                await saveItem(item)
            } else if (outcome.status === 404) {
                issues.progress_not_found += 1
                log(`进度接口返回 404，未写入 subject=${item.subject_id}`, 'warn')
            } else {
                issues.progress_bad_response += 1
                log(`进度返回体异常，未写入 subject=${item.subject_id}`, 'warn')
            }
            done += 1
            progress(done)
            // Only a written record marks the subject done; a failed or
            // unconfirmed response must be retried by the next resume.
            await checkpoint(done, taskStage.progress, total,
                outcome.ok ? item.subject_id : undefined)
        }
    }

    // Cancel must propagate; any other failure keeps the record's existing
    // user object instead of overwriting it with a placeholder.
    async function resolveUserInfo() {
        try {
            const info = await api.getUserInfo(target)
            if (info && info.username) return info
            log(`获取 ${target} 的账号信息失败: 响应缺少 username，保留原有资料`, 'warn')
        } catch (error) {
            if (isAbortError(error) || signal.aborted) throw abortError()
            log(`获取 ${target} 的账号信息失败: ${error.message}，保留原有资料`, 'warn')
        }
        return null
    }

    async function runFinalize() {
        if (signal.aborted) throw abortError()
        // The task token must still be current before anything is deleted; an
        // import or cache clear during the run aborts the run instead.
        requireTask(await advanceTask(target, taskId, {}))
        // Deleting records that are no longer in the collection list is only
        // safe after a complete listing; an incomplete list aborts first. The
        // target set is the list this task fetched or resumed with, so full,
        // incremental and resumed runs remove the same way.
        if (!collectionComplete || plan.items.length !== collectionTotal) {
            throw new Error(`收藏列表不完整，已中止收尾: ${plan.items.length}/${collectionTotal}`)
        }
        stage('收尾合并', 2)
        const userInfo = await resolveUserInfo()
        // A stop requested while resolving the profile must not delete or
        // complete anything.
        if (signal.aborted) throw abortError()
        const kept = new Set(plan.items.map(item => item.subject_id))
        // Deleting, marking complete and dropping the saved list happen in one
        // transaction: a failure leaves the task resumable with every record
        // still present.
        const removed = await finalizeBackup(target, {
            taskId,
            keep: kept,
            user: userInfo,
            completeness: { total: plan.items.length, done: plan.items.length },
        })
        if (removed === null) throw new Error('任务记录已变更，本次执行中止')
        if (removed > 0) log(`已删除 ${removed} 条不再收藏的条目`, 'warn')
        log(`备份完成: ${plan.items.length} 条`, 'success')
        progress(2)
        return removed
    }

    async function execute() {
        const token = await requireAccessToken(authUsername, { signal })
        api = new BangumiApi({
            token,
            interval: settings.interval,
            maxRetries: settings.maxRetries,
            signal,
            onLog: log,
            onRetry: (message, attempt, total, delay) => {
                const seconds = Math.round((Number(delay) || retryWaitMs) / 1000)
                log(`${message} — ${seconds}s 后重试 (${attempt}/${total})`, 'warn')
            },
            onUnauthorized: () => refreshAccessToken(authUsername, { signal }),
        })

        await ensureUserRecord(target)
        const task = await openTask()
        taskId = task.task_id
        activeMode = mode === taskResume ? task.mode : mode
        log(`开始 ${activeMode === 'full' ? '全量' : '增量'}备份 ${target} · 间隔 ${settings.interval}ms · 重试 ${settings.maxRetries} 次`)
        log(`授权身份 ${authUsername} · 信息范围 ${infoScope === infoScopes.private ? '私有' : '公开'}`)

        if (!taskStages.includes(task.stage)) throw new Error('任务阶段无效')
        let currentStage = task.stage
        // Item stages resume from the finished ids of their own stage, never
        // from a list index.
        let doneIds = await readDoneIds(task)

        const list = await fetchCollections(task)
        cachedRecords = await items.getByOwner(target)
        plan = planItems(list, cachedRecords, activeMode, infoScope)
        log(`收藏列表 ${list.length} 条 · 本地记录 ${cachedRecords.length} 条`)
        log(`续传阶段 ${currentStage} · 本阶段已完成 ${doneIds.size} 条`)

        if (currentStage === taskStage.collections) {
            currentStage = taskStage.subjects
            doneIds = new Set()
            await enterStage(currentStage)
        }
        if (currentStage === taskStage.subjects) {
            await runSubjects(doneIds)
            currentStage = taskStage.episodes
            doneIds = new Set()
            await enterStage(currentStage)
        }
        if (currentStage === taskStage.episodes) {
            await runEpisodes(doneIds)
            currentStage = taskStage.progress
            doneIds = new Set()
            await enterStage(currentStage)
        }
        if (currentStage === taskStage.progress) {
            await runProgress(doneIds)
            currentStage = taskStage.finalize
            doneIds = new Set()
            await enterStage(currentStage)
        }
        const removed = await runFinalize()
        stage('完成', 1)
        progress(1)
        const result = {
            mode: activeMode,
            requestedMode: mode,
            resumed: mode === taskResume,
            count: plan.items.length,
            removed,
            infoScope,
            static: {
                subject: { ...staticStats.subject },
                episode: { ...staticStats.episode },
            },
            issues: { ...issues },
        }
        // A broken shard, a missing id and an unreadable manifest stay separate:
        // they have different causes and different remedies.
        if (staticBroken(staticStats.subject)) {
            log(`静态条目数据不完整，已用接口补齐：分片失败 ${staticStats.subject.chunk_failures} · 解析失败 ${staticStats.subject.parse_failures} · 清单读取失败 ${staticStats.subject.manifest_failures}`, 'warn')
        }
        if (staticBroken(staticStats.episode)) {
            log(`静态分集数据不完整，已用接口补齐：分片失败 ${staticStats.episode.chunk_failures} · 解析失败 ${staticStats.episode.parse_failures} · 清单读取失败 ${staticStats.episode.manifest_failures}`, 'warn')
        }
        const unreliable = staticStats.subject.manifest_unreliable + staticStats.episode.manifest_unreliable
        const unreachable = staticStats.subject.snapshot_miss_unreliable + staticStats.episode.snapshot_miss_unreliable
        if (unreliable > 0) {
            const unreachableNote = unreachable > 0 ? ` · 条目与分集合计仍未取得 ${unreachable} 条` : ''
            log(`静态清单不可靠，已扫描全部分片：条目 ${staticStats.subject.manifest_unreliable} · 分集 ${staticStats.episode.manifest_unreliable}${unreachableNote}`, 'warn')
        }
        const missedParts = []
        if (staticStats.subject.snapshot_miss > 0) missedParts.push(`条目 ${staticStats.subject.snapshot_miss}`)
        if (staticStats.episode.snapshot_miss > 0) missedParts.push(`缺分集的条目 ${staticStats.episode.snapshot_miss}`)
        if (missedParts.length) {
            log(`静态快照未覆盖：${missedParts.join(' · ')}，已交给接口补取`, 'warn')
        }
        if (staticStats.episode.episode_shortfall > 0) {
            log(`静态分集少于条目话数，已用接口补齐：${staticStats.episode.episode_shortfall} 条`, 'warn')
        }
        return result
    }

    // The pause covers the whole backup: the list, every static read and every
    // API call happen while the prefetch behind them stays stopped, so the two
    // never compete for the same connection.
    return async function run() {
        if (!target) throw new Error('缺少目标用户名')
        if (!runModes.includes(mode)) throw new Error('未知任务类型')
        bgm.pause()
        try {
            return await execute()
        } finally {
            bgm.close()
        }
    }
}

// The worker reports the files a finished round could not store. Only the
// backup page imports this module, so its log is where the count and the
// reason are shown to the reader; the message would otherwise reach no one.
const missingReasonText = {
    failed: '下载失败',
    mismatch: '内容与清单不符',
}
const missingSampleLimit = 3

let missingLog = null
let missingListening = false

function describeMissing(data) {
    const count = Number(data.count) || 0
    if (!count) return ''
    const reasons = data.reasons && typeof data.reasons === 'object' ? data.reasons : {}
    const paths = Array.isArray(data.paths) ? data.paths : []
    const samples = paths.slice(0, missingSampleLimit).map(pathname => {
        const reason = missingReasonText[reasons[pathname]] || reasons[pathname] || '原因未知'
        return `${pathname}（${reason}）`
    })
    const rest = count > samples.length ? `，另有 ${count - samples.length} 个` : ''
    return `缓存缺失 ${count} 个文件：${samples.join('、')}${rest}`
}

function listenMissing() {
    if (missingListening) return
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    missingListening = true
    navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data || {}
        if (data.type !== 'CACHE_MISSING') return
        const text = describeMissing(data)
        if (text) missingLog?.(text, 'warn')
    })
}

// Pass `restart: true` only after the user confirms replacing the unfinished
// task reported by a TaskConflictError; without it the conflict is rethrown.
export function startBackup(options = {}) {
    missingLog = options.onLog || null
    listenMissing()
    const controller = new AbortController()
    const run = createRun(options, controller.signal)
    return {
        stop() {
            controller.abort()
        },
        promise: run(),
    }
}
