import { importExport } from '../app.js'
import { loadFromFile, loadFromUrl } from '../source.js'
import { href } from '../config.js'
import { beginLoading } from './loading.js'

// The job outlives the page markup, so its state lives at module level and
// every render reads it back instead of starting from an empty view.
// 'idle' | 'loading' | 'writing'
let phase = 'idle'
let phaseLabel = ''
let viewToken = 0
let applyState = () => {}

const writingStatus = '正在写入数据库，此步骤不能取消'

function setStatus(container, message, kind = '') {
    const el = container.querySelector('#import-status')
    if (!el) return
    el.textContent = message
    el.className = 'form-status' + (kind ? ' is-' + kind : '')
}

export function renderImport() {
    const main = document.getElementById('main')
    if (!main) return
    const token = ++viewToken

    main.innerHTML = `
        <div class="import-wrap">
            <div class="import-drop" id="import-drop" tabindex="0" role="button"
                aria-label="拖入或点击选择备份文件">
                <h1>导入备份文件</h1>
                <p>拖入或点击选择 JSON / ZIP</p>
                <input type="file" id="import-file" accept=".json,.zip,application/json,application/zip" hidden>
            </div>
            <div class="import-url">
                <div class="import-url-row">
                    <input class="input-search" type="url" id="import-url"
                        placeholder="https://example.com/takeout.json" autocomplete="off"
                        aria-label="JSON 或 ZIP 地址">
                    <button type="button" class="btn btn-primary" id="import-url-btn">加载</button>
                </div>
                <div class="import-url-row">
                    <div class="form-status" id="import-status" role="status" aria-live="polite"></div>
                </div>
            </div>
        </div>
    `

    const drop = main.querySelector('#import-drop')
    const fileInput = main.querySelector('#import-file')
    const urlInput = main.querySelector('#import-url')
    const urlButton = main.querySelector('#import-url-btn')

    // Buttons follow the job, not the render: a page entered while a job runs
    // must show the running status.
    const sync = () => {
        const running = phase !== 'idle'
        urlButton.disabled = running
        if (phase === 'loading') setStatus(main, phaseLabel)
        else if (phase === 'writing') setStatus(main, writingStatus)
    }
    applyState = () => {
        if (token === viewToken) sync()
    }
    sync()

    const openPick = () => {
        if (phase !== 'idle') return
        fileInput.click()
    }

    drop.addEventListener('click', openPick)
    drop.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        openPick()
    })

    ;['dragenter', 'dragover'].forEach(type => {
        drop.addEventListener(type, event => {
            event.preventDefault()
            drop.classList.add('is-drag')
        })
    })
    ;['dragleave', 'drop'].forEach(type => {
        drop.addEventListener(type, event => {
            event.preventDefault()
            drop.classList.remove('is-drag')
        })
    })
    drop.addEventListener('drop', event => {
        const file = event.dataTransfer?.files?.[0]
        if (!file) return
        load(signal => loadFromFile(file, { signal }), '正在解析文件…')
    })

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0]
        if (!file) return
        load(signal => loadFromFile(file, { signal }), '正在解析文件…')
    })

    urlButton.addEventListener('click', () => {
        const url = urlInput.value.trim()
        if (!url) {
            setStatus(main, '请输入地址', 'error')
            return
        }
        load(signal => loadFromUrl(url, { signal }), '正在下载并解析…')
    })
    urlInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault()
            urlButton.click()
        }
    })

    async function load(getRaw, label) {
        if (phase !== 'idle') return
        const jobController = new AbortController()
        phase = 'loading'
        phaseLabel = label
        fileInput.value = ''
        applyState()
        // The mask covers the page, so it carries the only reachable cancel.
        const loading = beginLoading(label, {
            onCancel: () => {
                if (phase !== 'loading') return
                setStatus(main, '正在取消…')
                jobController.abort()
            },
            fallbackFocus: () => main.querySelector('#import-status'),
        })
        try {
            const raw = await getRaw(jobController.signal)
            // The database write cannot be interrupted, so the cancel entry goes
            // away before it starts and the status says why.
            phase = 'writing'
            applyState()
            setStatus(main, writingStatus)
            loading.update({ label: writingStatus })
            await importExport(raw)
            phase = 'idle'
            applyState()
            setStatus(main, '导入完成')
            // A finished import must not yank the user back after they left.
            if (token === viewToken && main.dataset.route === 'import') location.href = href.index
        } catch (error) {
            phase = 'idle'
            applyState()
            if (jobController.signal.aborted) setStatus(main, '已取消导入')
            else setStatus(main, error?.message || String(error), 'error')
        } finally {
            loading.close()
        }
    }
}
