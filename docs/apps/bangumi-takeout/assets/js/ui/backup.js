import { state, loadUser, selectUser } from '../app.js'
import { meta } from '../storage.js'
import { discardTask, getTask, TASK_STATUS } from '../tasks.js'
import {
    addAccessToken, beginAuthorization, listCredentials,
} from '../backup/auth.js'
import { startBackup } from '../backup/runner.js'
import { isAbortError } from '../backup/api.js'
import {
    getDefaultSource, VIEW_CLEARED_KEY,
    REQUEST_INTERVAL_KEY, REQUEST_INTERVAL_LIMITS, REQUEST_INTERVAL_OPTIONS,
    REQUEST_RETRY_KEY, REQUEST_RETRY_LIMITS, REQUEST_RETRY_OPTIONS,
} from '../config.js'
import { escapeHtml, makeMenuButton, paintMenuButton, unique } from '../dom.js'
import { closeMenu, openMenu } from './menu.js'
import { syncHeader } from '../layout.js'

const STAGE_LABELS = ['收藏列表', '条目', '分集', '进度', '收尾']
const STAGE_INDEX_BY_NAME = {
    '拉取收藏列表': 0,
    '拉取条目': 1,
    '拉取分集': 2,
    '拉取观看进度': 3,
    '收尾合并': 4,
    // The static read runs before the matching item stage, so it shares that
    // stage's node and progress total.
    '读取静态 subject 数据': 1,
    '读取静态 episode 数据': 2,
}
const TASK_STAGE_INDEX = {
    collections: 0,
    subjects: 1,
    episodes: 2,
    progress: 3,
    finalize: 4,
}
const MODE_LABELS = {
    full: '全量备份',
    incremental: '增量备份',
    resume: '继续中断',
}

let selectedAuth = ''
let preferredAuth = ''
let targetValue = ''
let defaultUsername = ''
let credentials = []
let usernames = []
let taskInfo = { status: TASK_STATUS.MISSING_META, task: null }
let running = false
let starting = false
let verifying = false
let verifyController = null
let runHandle = null
let notice = ''
let noticeTarget = 'auth'
let progress = { index: -1, label: '就绪', done: 0, total: 0 }
let logs = []
let targetTimer = null
let taskTarget = ''
let taskSeq = 0

let interval = readSetting(REQUEST_INTERVAL_KEY, REQUEST_INTERVAL_LIMITS)
let maxRetries = readSetting(REQUEST_RETRY_KEY, REQUEST_RETRY_LIMITS)

function readSetting(key, limits) {
    const stored = Number(localStorage.getItem(key))
    if (Number.isFinite(stored) && stored >= limits.min && stored <= limits.max) return stored
    return limits.fallback
}

function hasAuth() {
    return credentials.some(item => item.username === selectedAuth)
}

function canStart() {
    return !running && !verifying && !!targetValue.trim() && hasAuth()
        && taskInfo.status !== TASK_STATUS.UNFINISHED
}

function canResume() {
    return !running && !verifying && !!targetValue.trim() && hasAuth()
        && taskTarget === targetValue.trim()
        && taskInfo.status === TASK_STATUS.UNFINISHED
        && (taskInfo.task?.auth_username || '') === selectedAuth
}

function canDiscard() {
    // taskInfo may belong to the previous target while the debounce runs;
    // never enable the button unless it describes the current one.
    return !running && !starting && !verifying
        && !!targetValue.trim()
        && taskTarget === targetValue.trim()
        && taskInfo.status === TASK_STATUS.UNFINISHED
}

export function setPreferredAuth(username) {
    preferredAuth = username || ''
}

export function setNotice(message, target = 'auth') {
    notice = message || ''
    noticeTarget = target
}

async function refreshTask() {
    const username = targetValue.trim()
    const seq = ++taskSeq
    if (!username) {
        taskInfo = { status: TASK_STATUS.MISSING_META, task: null }
        taskTarget = ''
        return
    }
    const info = await getTask(username, { includeCompleted: true })
    // Drop stale reads so a later target cannot be painted with an early task.
    if (seq !== taskSeq || username !== targetValue.trim()) return
    taskInfo = info
    taskTarget = username
}

function syncProgressFromTask() {
    if (running) return
    const task = taskInfo.task
    if (taskInfo.status === TASK_STATUS.UNFINISHED && task) {
        const index = TASK_STAGE_INDEX[task.stage] ?? -1
        progress = {
            index,
            label: index >= 0 ? STAGE_LABELS[index] : '就绪',
            done: task.progress?.done || 0,
            total: task.progress?.total || 0,
        }
        return
    }
    if (taskInfo.status === TASK_STATUS.COMPLETED && task) {
        progress = {
            index: STAGE_LABELS.length,
            label: '完成',
            done: task.progress?.done || 0,
            total: task.progress?.total || 0,
        }
        return
    }
    progress = { index: -1, label: '就绪', done: 0, total: 0 }
}

export async function renderBackup() {
    const main = document.getElementById('main')
    if (!main) return
    // A background run may finish after the route changed; it must not paint
    // over another page.
    if (main.dataset.route !== 'backup') return
    closeMenu()

    defaultUsername = getDefaultSource().username
    if (!targetValue) targetValue = state.data?.user?.username || defaultUsername

    const [records, stored] = await Promise.all([meta.list(), listCredentials()])
    credentials = stored
    usernames = unique([defaultUsername, ...records.map(record => record.username)])

    if (preferredAuth && credentials.some(item => item.username === preferredAuth)) {
        selectedAuth = preferredAuth
        preferredAuth = ''
    } else if (!credentials.some(item => item.username === selectedAuth)) {
        const viewUser = state.data?.user?.username
        selectedAuth = credentials.find(item => item.username === viewUser)?.username
            || credentials[0]?.username
            || ''
    }

    await refreshTask()
    syncProgressFromTask()
    // The route may have changed while the stores were read.
    if (main.dataset.route !== 'backup') return
    renderShell(main)
    bindTarget(main)
    bindAuth(main)
    bindSettings(main)
    bindActions(main)
    paintAll()
}

function stageStripHtml() {
    const parts = []
    for (let i = 0; i < STAGE_LABELS.length; i += 1) {
        parts.push(`<span class="stage-node" data-stage="${i}" title="${STAGE_LABELS[i]}"></span>`)
        if (i < STAGE_LABELS.length - 1) parts.push('<span class="stage-bar"></span>')
    }
    return parts.join('')
}

function renderShell(main) {
    const authName = selectedAuth || '未选择'
    const authInitial = selectedAuth ? selectedAuth.slice(0, 1) : '?'
    const authState = hasAuth() ? '有效凭证' : '远程备份不可用'

    main.innerHTML = `
        <div class="backup-head"><h1>备份</h1></div>
        <div class="backup-grid">
            <div class="backup-col">
                <section class="panel">
                    <h2 class="panel-title">备份目标</h2>
                    <div class="field field-target">
                        <span class="field-label">username</span>
                        <div class="target-control">
                            <span id="target-select-slot"></span>
                            <input type="text" id="target-input" value="${escapeHtml(targetValue)}"
                                placeholder="任意 Bangumi username" autocomplete="off"
                                aria-label="备份目标 username" ${running ? 'disabled' : ''}>
                        </div>
                    </div>
                </section>

                <section class="panel">
                    <h2 class="panel-title">授权账号</h2>
                    <div class="account-line">
                        <span class="avatar avatar-fallback">${escapeHtml(authInitial)}</span>
                        <div>
                            <div class="account-name">${escapeHtml(authName)}</div>
                            <div class="account-sub">${authState}</div>
                        </div>
                    </div>
                    <div class="field field-stack">
                        <span class="field-label">切换授权账号</span>
                        <span id="auth-select-slot"></span>
                    </div>
                    <div class="row-actions">
                        <button type="button" class="btn" id="b-login" ${running ? 'disabled' : ''}>OAuth 授权新账号</button>
                        <button type="button" class="btn" id="b-paste" ${running ? 'disabled' : ''}>粘贴访问令牌</button>
                    </div>
                    <div class="paste-form" id="paste-form" hidden>
                        <input type="password" id="paste-input" autocomplete="off"
                            placeholder="访问令牌" aria-label="访问令牌" ${running ? 'disabled' : ''}>
                        <div class="row-actions">
                            <button type="button" class="btn btn-primary" id="paste-save" ${running ? 'disabled' : ''}>保存</button>
                            <button type="button" class="btn" id="paste-cancel" ${running ? 'disabled' : ''}>取消</button>
                        </div>
                    </div>
                    <div class="form-status" id="auth-status" role="status" aria-live="polite"></div>
                </section>

                <section class="panel">
                    <h2 class="panel-title">任务记录</h2>
                    <div id="task-record"></div>
                </section>

                <section class="panel">
                    <h2 class="panel-title">请求设置</h2>
                    <div class="settings-row">
                        <span>请求间隔</span>
                        <span class="inline-select-slot" id="interval-slot"></span>
                    </div>
                    <div class="settings-row">
                        <span>失败重试</span>
                        <span class="inline-select-slot" id="retry-slot"></span>
                    </div>
                </section>
            </div>

            <div class="backup-col">
                <section class="panel">
                    <h2 class="panel-title">执行</h2>
                    <div class="stage-strip" id="stage-strip">${stageStripHtml()}</div>
                    <div class="row-actions">
                        <button type="button" class="task-btn" id="b-full" ${canStart() ? '' : 'disabled'}>全量备份</button>
                        <button type="button" class="task-btn" id="b-inc" ${canStart() ? '' : 'disabled'}>增量备份</button>
                        <button type="button" class="task-btn" id="b-resume" ${canResume() ? '' : 'disabled'}>继续</button>
                        <button type="button" class="task-btn" id="b-stop" ${running ? '' : 'disabled'}>停止备份</button>
                    </div>
                    <div class="progress-block">
                        <div class="progress-line">
                            <span id="progress-stage">就绪</span>
                            <span id="progress-ratio">0%</span>
                        </div>
                        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
                        <div class="progress-meta"><span id="progress-count">0 / 0</span></div>
                    </div>
                    <div class="form-status" id="run-status" role="status" aria-live="polite"></div>
                </section>

                <section class="panel">
                    <h2 class="panel-title">日志</h2>
                    <div class="log" id="backup-log"></div>
                </section>
            </div>
        </div>
    `
}

function bindTarget(main) {
    const slot = main.querySelector('#target-select-slot')
    const input = main.querySelector('#target-input')
    const button = makeMenuButton(usernames.includes(targetValue) ? targetValue : '其他', { disabled: running })
    button.id = 'target-select-btn'
    slot.appendChild(button)

    const paint = () => {
        paintMenuButton(button, usernames.includes(targetValue) ? targetValue : '其他')
    }

    button.addEventListener('click', () => {
        if (running) return
        openMenu({
            anchor: button,
            items: [
                { value: '__other__', label: '其他' },
                ...usernames.map(name => ({
                    value: name,
                    label: name,
                    tag: name === defaultUsername ? '默认' : '',
                })),
            ],
            current: usernames.includes(targetValue) ? targetValue : '__other__',
            onPick: value => {
                if (value === '__other__') {
                    paintMenuButton(button, '其他')
                    input.focus()
                    return
                }
                targetValue = value
                input.value = value
                paint()
                // Disable target-bound actions before the debounced reload.
                paintButtons()
                updateTaskState()
            },
        })
    })

    input.addEventListener('input', () => {
        targetValue = input.value
        paint()
        clearTimeout(targetTimer)
        targetTimer = setTimeout(updateTaskState, 250)
    })
}

async function updateTaskState() {
    const target = targetValue.trim()
    await refreshTask()
    if (target !== targetValue.trim()) return
    syncProgressFromTask()
    paintTaskRecord()
    paintButtons()
    paintProgress()
}

function bindAuth(main) {
    const slot = main.querySelector('#auth-select-slot')
    const button = makeMenuButton(
        selectedAuth || (credentials.length ? '选择授权账号' : '暂无账号'),
        { disabled: running || !credentials.length }
    )
    button.id = 'auth-select-btn'
    slot.appendChild(button)

    button.addEventListener('click', () => {
        if (button.disabled) return
        openMenu({
            anchor: button,
            items: credentials.map(item => ({
                value: item.username,
                label: item.username,
                tag: '有效凭证',
            })),
            current: selectedAuth,
            onPick: value => {
                selectedAuth = value
                return renderBackup()
            },
        })
    })

    main.querySelector('#b-login').addEventListener('click', () => {
        if (running) return
        beginAuthorization()
    })

    const form = main.querySelector('#paste-form')
    main.querySelector('#b-paste').addEventListener('click', () => {
        if (running) return
        form.hidden = !form.hidden
        if (!form.hidden) main.querySelector('#paste-input').focus()
    })
    main.querySelector('#paste-cancel').addEventListener('click', () => {
        // While verification runs, cancel aborts the request; otherwise it only
        // closes the form.
        if (verifying) {
            verifyController?.abort()
            return
        }
        form.hidden = true
        main.querySelector('#paste-input').value = ''
    })
    main.querySelector('#paste-save').addEventListener('click', async () => {
        if (running || verifying) return
        const input = main.querySelector('#paste-input')
        const token = input.value.trim()
        if (!token) {
            setNotice('访问令牌为空')
            paintStatus()
            return
        }
        verifying = true
        const controller = new AbortController()
        verifyController = controller
        paintButtons()
        setNotice('正在核验令牌…')
        paintStatus()
        let result = null
        try {
            result = await addAccessToken(token, { signal: controller.signal })
        } catch (error) {
            verifying = false
            verifyController = null
            // A backup may have started during verification; the run then owns
            // the UI.
            if (!running) {
                if (isAbortError(error)) {
                    form.hidden = true
                    input.value = ''
                    setNotice('已取消核验')
                } else {
                    setNotice(error?.message || String(error))
                }
                paintButtons()
                paintStatus()
            }
            return
        }
        verifying = false
        verifyController = null
        // Drop a late verification result during a run so it cannot overwrite
        // the active auth and notice.
        if (running) return
        selectedAuth = result.username
        setNotice('已添加 ' + result.username)
        form.hidden = true
        input.value = ''
        await renderBackup()
    })
}

function bindSettings(main) {
    const intervalSlot = main.querySelector('#interval-slot')
    const retrySlot = main.querySelector('#retry-slot')
    const intervalButton = makeMenuButton(
        REQUEST_INTERVAL_OPTIONS.find(item => item.value === interval)?.label || String(interval)
    )
    const retryButton = makeMenuButton(
        REQUEST_RETRY_OPTIONS.find(item => item.value === maxRetries)?.label || String(maxRetries)
    )
    intervalSlot.appendChild(intervalButton)
    retrySlot.appendChild(retryButton)

    intervalButton.addEventListener('click', () => {
        openMenu({
            anchor: intervalButton,
            items: REQUEST_INTERVAL_OPTIONS.map(item => ({
                value: String(item.value),
                label: item.label,
            })),
            current: String(interval),
            onPick: value => {
                interval = Number(value)
                localStorage.setItem(REQUEST_INTERVAL_KEY, String(interval))
                paintMenuButton(intervalButton, REQUEST_INTERVAL_OPTIONS
                    .find(item => item.value === interval)?.label || value)
            },
        })
    })

    retryButton.addEventListener('click', () => {
        openMenu({
            anchor: retryButton,
            items: REQUEST_RETRY_OPTIONS.map(item => ({
                value: String(item.value),
                label: item.label,
            })),
            current: String(maxRetries),
            onPick: value => {
                maxRetries = Number(value)
                localStorage.setItem(REQUEST_RETRY_KEY, String(maxRetries))
                paintMenuButton(retryButton, REQUEST_RETRY_OPTIONS
                    .find(item => item.value === maxRetries)?.label || value)
            },
        })
    })
}

function bindActions(main) {
    main.querySelector('#b-full').addEventListener('click', () => startRun('full'))
    main.querySelector('#b-inc').addEventListener('click', () => startRun('incremental'))
    main.querySelector('#b-resume').addEventListener('click', () => startRun('resume'))
    main.querySelector('#b-stop').addEventListener('click', () => runHandle?.stop())
    // The discard button is rendered only with an unusable checkpoint, so it
    // is delegated rather than bound when the shell is built.
    main.addEventListener('click', event => {
        if (event.target.closest('#b-discard')) discardCheckpoint()
    })
}

async function discardCheckpoint() {
    const button = document.getElementById('b-discard')
    // The recorded target is the one taskInfo describes, not whatever the
    // input holds by the time this handler runs.
    const target = button?.dataset.target || ''
    const taskId = button?.dataset.taskId || ''
    if (running || starting || verifying) return
    if (!target || target !== targetValue.trim() || !canDiscard()) return
    if (!window.confirm(`放弃断点会丢失目标「${target}」当前的续传进度，之后只能重新开始备份。确定放弃吗？`)) {
        return
    }
    // Re-check after the modal: a backup may have started, the target may have
    // changed, and either would make this a different checkpoint.
    if (running || starting || verifying) return
    if (target !== targetValue.trim()) return
    starting = true
    paintButtons()
    try {
        const latest = await getTask(target, { includeCompleted: true })
        if (latest.status !== TASK_STATUS.UNFINISHED || !latest.task) {
            setNotice('目标「' + target + '」没有可放弃的断点', 'run')
            return
        }
        // Another tab may have started a new task; discard only the one the
        // button recorded.
        if (!taskId || latest.task.task_id !== taskId) {
            setNotice('任务已变化，未放弃「' + target + '」的断点', 'run')
            return
        }
        if (target !== targetValue.trim()) {
            setNotice('目标已切换，未放弃「' + target + '」的断点', 'run')
            return
        }
        await discardTask(target)
        setNotice('已放弃断点（目标「' + target + '」），可以重新开始备份', 'run')
    } catch (error) {
        setNotice('放弃断点失败：' + (error?.message || error), 'run')
    } finally {
        starting = false
        await renderBackup()
    }
}

async function startRun(mode) {
    if (running || starting || verifying) return
    starting = true
    try {
        await runBackup(mode)
    } catch (error) {
        setNotice('备份启动失败：' + (error?.message || error), 'run')
        paintStatus()
    } finally {
        starting = false
        // runBackup's final render still saw starting=true; repaint so the
        // discard button leaves its disabled startup state immediately.
        paintButtons()
    }
}

async function runBackup(mode) {
    const target = targetValue.trim()
    if (!target) {
        setNotice('请填写备份目标', 'run')
        paintStatus()
        return
    }

    try {
        credentials = await listCredentials()
        taskInfo = await getTask(target, { includeCompleted: true })
    } catch (error) {
        setNotice('读取本地凭证或任务失败：' + (error?.message || error), 'run')
        paintButtons()
        paintStatus()
        return
    }

    if (!credentials.some(item => item.username === selectedAuth)) {
        setNotice('没有有效授权，不能开始备份', 'run')
        paintButtons()
        paintStatus()
        return
    }

    if (mode === 'resume') {
        if (taskInfo.status !== TASK_STATUS.UNFINISHED) {
            setNotice('该目标没有可继续的断点', 'run')
            paintButtons()
            paintStatus()
            return
        }
        if ((taskInfo.task?.auth_username || '') !== selectedAuth) {
            setNotice('断点属于授权账号 ' + (taskInfo.task?.auth_username || '—')
                + '，可先放弃断点再重新开始', 'run')
            paintButtons()
            paintStatus()
            return
        }
    } else if (taskInfo.status === TASK_STATUS.UNFINISHED) {
        setNotice('该目标已有未完成任务，请先继续或放弃断点', 'run')
        paintButtons()
        paintStatus()
        return
    }

    running = true
    notice = ''
    logs = []
    progress = { index: -1, name: '', label: '准备中', done: 0, total: 0 }
    paintTaskRecord()
    paintButtons()
    paintProgress()
    paintLog()
    paintStatus()

    // The viewer may pick or leave a user while the run is in flight; remember
    // the view at this moment so the finish step can tell who chose last.
    const viewAtStart = state.data?.user?.username || ''
    const clearedAtStart = localStorage.getItem(VIEW_CLEARED_KEY) || ''

    const handle = startBackup({
        username: target,
        authUsername: selectedAuth,
        mode,
        interval,
        maxRetries,
        onStage: (name, total) => {
            if (name === '完成') {
                progress = { index: STAGE_LABELS.length, label: '完成', done: 1, total: 1 }
            } else {
                // A new stage name resets the finished count even when two names
                // share one node. The note is kept only for a mapped name, so an
                // unknown stage never repeats its own text.
                const base = name.split('（')[0]
                const mapped = STAGE_INDEX_BY_NAME[base]
                const index = mapped ?? progress.index
                if (name !== progress.name || index !== progress.index) progress.done = 0
                progress.name = name
                progress.index = index
                progress.total = total || 0
                progress.label = mapped === undefined ? name : STAGE_LABELS[mapped] + name.slice(base.length)
            }
            paintProgress()
        },
        onProgress: done => {
            progress.done = done
            paintProgress()
        },
        onLog: (message, type) => {
            logs.push({ message, type })
            if (logs.length > 120) logs = logs.slice(-120)
            paintLog()
        },
    })
    runHandle = handle

    let completed = false
    try {
        await handle.promise
        completed = true
        setNotice('备份完成', 'run')
    } catch (error) {
        if (isAbortError(error)) {
            setNotice('已停止，任务保持未完成', 'run')
        } else {
            setNotice('备份失败：' + (error?.message || error), 'run')
        }
    } finally {
        running = false
        runHandle = null
        await refreshTask()
        const viewed = state.data?.user?.username || ''
        const viewUnchanged = viewed === viewAtStart
            && (localStorage.getItem(VIEW_CLEARED_KEY) || '') === clearedAtStart
        // A user chosen after the run started wins over the backup target.
        if (viewed === target || (!viewed && viewUnchanged)) {
            // A first backup with no viewed user must still feed the collection
            // page; otherwise it keeps showing the welcome card.
            const hit = await loadUser(target)
            if (hit) {
                state.data = hit
                selectUser(target)
            }
        }
        await renderBackup()
        if (completed) {
            syncHeader()
            // Refresh the collection in place when it is the visible route; a
            // finished background run must not navigate away.
            if (document.getElementById('main')?.dataset.route === 'overview') {
                window.dispatchEvent(new Event('app:rerender'))
            }
        }
    }
}

function paintAll() {
    paintTaskRecord()
    paintButtons()
    paintProgress()
    paintLog()
    paintStatus()
}

function paintTaskRecord() {
    const el = document.getElementById('task-record')
    if (!el) return
    const task = taskInfo.task
    let stateLabel = '无任务'
    if (running) stateLabel = '运行中'
    else if (taskInfo.status === TASK_STATUS.UNFINISHED) stateLabel = '未完成'
    else if (taskInfo.status === TASK_STATUS.COMPLETED) stateLabel = '已完成'

    if (!task) {
        el.innerHTML = `<p class="hint">${stateLabel === '运行中' ? '正在执行备份。' : '尚无任务记录。'}</p>`
        return
    }

    const done = task.progress?.done || 0
    const total = task.progress?.total || 0
    const updated = task.updated_at ? new Date(task.updated_at).toLocaleString() : '—'
    const unfinished = taskInfo.status === TASK_STATUS.UNFINISHED
    const authMismatch = unfinished
        && (task.auth_username || '') !== selectedAuth
    const resumeReady = unfinished && hasAuth() && !authMismatch
    const hint = !unfinished
        ? ''
        : resumeReady
            ? '<p class="hint">可继续该断点。</p>'
            : `<p class="hint">${hasAuth()
                ? `断点属于授权账号 ${escapeHtml(task.auth_username || '—')}，当前授权不同`
                : '当前没有有效授权，无法继续该断点'}；可放弃断点后重新开始。放弃会丢失断点进度。</p>`
    // A usable checkpoint keeps its discard action out of the way; only a
    // checkpoint the current credential cannot resume shows one.
    const discardHtml = unfinished && !resumeReady
        ? `<div class="task-discard">
                <button type="button" class="task-btn" id="b-discard" ${canDiscard() ? '' : 'disabled'}>放弃断点</button>
            </div>`
        : ''
    el.innerHTML = `
        <div class="task-row"><span>状态</span><strong>${stateLabel}</strong></div>
        <div class="task-row"><span>模式</span><strong>${MODE_LABELS[task.mode] || task.mode}</strong></div>
        <div class="task-row"><span>授权 → 目标</span><strong>${escapeHtml((task.auth_username || '—') + ' → ' + targetValue)}</strong></div>
        <div class="task-row"><span>进度</span><strong>${done} / ${total}</strong></div>
        <div class="task-row"><span>更新</span><strong>${escapeHtml(updated)}</strong></div>
        ${hint}
        ${discardHtml}
    `
}

function paintButtons() {
    const set = (id, disabled) => {
        const el = document.getElementById(id)
        if (el) el.disabled = disabled
    }
    set('b-full', !canStart())
    set('b-inc', !canStart())
    set('b-resume', !canResume())
    set('b-discard', !canDiscard())
    set('b-stop', !running)
    set('b-login', running || verifying)
    set('b-paste', running || verifying)
    set('paste-input', running || verifying)
    set('paste-save', running || verifying)
    set('paste-cancel', running)
    set('target-select-btn', running)
    set('auth-select-btn', running || !credentials.length)

    const discard = document.getElementById('b-discard')
    if (discard) {
        const task = taskInfo.status === TASK_STATUS.UNFINISHED ? taskInfo.task : null
        discard.dataset.target = task ? taskTarget : ''
        discard.dataset.taskId = task?.task_id || ''
    }
    const input = document.getElementById('target-input')
    if (input) input.disabled = running
}

function paintProgress() {
    const nodes = document.querySelectorAll('#stage-strip .stage-node')
    nodes.forEach(node => {
        const index = Number(node.dataset.stage)
        node.classList.toggle('is-done', index < progress.index)
        node.classList.toggle('is-cur', index === progress.index)
    })
    const bars = document.querySelectorAll('#stage-strip .stage-bar')
    bars.forEach((bar, index) => bar.classList.toggle('is-fill', index < progress.index))

    const ratio = progress.total > 0
        ? Math.min(100, Math.round(progress.done / progress.total * 100))
        : 0
    const stageEl = document.getElementById('progress-stage')
    const ratioEl = document.getElementById('progress-ratio')
    const fillEl = document.getElementById('progress-fill')
    const countEl = document.getElementById('progress-count')
    if (stageEl) stageEl.textContent = progress.label || '就绪'
    if (ratioEl) ratioEl.textContent = ratio + '%'
    if (fillEl) fillEl.style.width = ratio + '%'
    if (countEl) countEl.textContent = `${progress.done} / ${progress.total}`
}

function paintLog() {
    const el = document.getElementById('backup-log')
    if (!el) return
    el.innerHTML = logs.length
        ? logs.map(line => `<div class="log-line ${line.type ? 'is-' + line.type : ''}">${escapeHtml(line.message)}</div>`).join('')
        : '<div class="log-line">等待操作…</div>'
    el.scrollTop = el.scrollHeight
}

function paintStatus() {
    const authEl = document.getElementById('auth-status')
    const runEl = document.getElementById('run-status')
    if (authEl) authEl.textContent = noticeTarget === 'auth' ? notice : ''
    if (runEl) runEl.textContent = noticeTarget === 'run' ? notice : ''
}
