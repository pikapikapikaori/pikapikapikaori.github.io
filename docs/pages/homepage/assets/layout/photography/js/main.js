import { agedFilter, baseUnit, columns, maxHeightUnits } from './config.js'

/* 窄屏每列最宽 6 个单位；间隔只补在单位之间，故 6 个单位含 5 个间隔。 */
const NARROW_UNIT_LIMIT = 6

function captionOf(App, id) {
    var table = App.photoCaptions && App.photoCaptions[App.i18n.get()]
    var caption = table && table[id]

    return caption || App.i18n.t('common.untitled') || ''
}

function photoMap(App) {
    var map = Object.create(null)

    App.photos.all().forEach(function (photo) {
        if (photo && photo.id) map[photo.id] = photo
    })

    return map
}

/* 只接受纯位置值，避免配置写入任意样式。 */
function safePosition(value) {
    return typeof value === 'string' && /^[-\w.%\s]+$/.test(value) ? value : ''
}

function unitValue(value) {
    return typeof value === 'number' && isFinite(value) && value > 0 ? value : 0
}

function findShot(track, id) {
    var shots = track.querySelectorAll('.pg-shot')

    for (var i = 0; i < shots.length; i++) {
        if (shots[i].dataset.photoId === id) return shots[i]
    }

    return null
}

function createShot(App, spec, photo) {
    var caption = captionOf(App, photo.id)
    var link = document.createElement('a')
    link.className = 'pg-shot'
    link.draggable = false
    link.dataset.photoId = photo.id
    link.dataset.realHref = photo.link || ''
    link.setAttribute('aria-label', caption)

    if (photo.link) {
        link.href = photo.link
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
    } else {
        link.tabIndex = 0
        link.setAttribute('role', 'button')
    }

    var img = document.createElement('img')
    img.src = photo.src
    img.alt = caption
    img.loading = 'lazy'
    img.decoding = 'async'
    img.draggable = false

    var position = safePosition(spec.position)
    if (position) img.style.objectPosition = position

    link.appendChild(img)
    return link
}

function createCaption(App, id) {
    var caption = document.createElement('p')
    var text = document.createElement('span')

    caption.className = 'pg-caption'
    text.className = 'pg-caption-text'
    text.textContent = captionOf(App, id)
    caption.appendChild(text)

    return caption
}

function createCell(App, spec, photo) {
    var cell = document.createElement('figure')
    var width = unitValue(spec.width)
    var height = unitValue(spec.height)

    if (!width || !height) return null

    cell.className = 'pg-cell'
    cell.style.setProperty('--pg-w', String(width))
    cell.style.setProperty('--pg-h', String(height))
    cell.appendChild(createShot(App, spec, photo))

    return cell
}

function rowHeightUnits(row) {
    return row.reduce(function (max, spec) {
        return Math.max(max, unitValue(spec.height))
    }, 0)
}

/* 每列按行从上往下排；超过最大高度时把余下各行接到新列。 */
function splitColumns() {
    var result = []

    columns.forEach(function (column) {
        var rows = []
        var used = 0
        var previous = []

        ;(column.rows || []).forEach(function (row) {
            var items = Array.isArray(row) ? row : []

            if (!items.length) return

            var height = rowHeightUnits(items)

            if (rows.length && used + height > maxHeightUnits + 1e-6) {
                previous.push(rows)
                rows = []
                used = 0
            }

            rows.push(items)
            used += height
        })

        if (rows.length) previous.push(rows)
        previous.forEach(function (part) {
            result.push(part)
        })
    })

    return result
}

function createColumn(App, rows, map) {
    var column = document.createElement('div')
    var media = document.createElement('div')
    var captions = document.createElement('div')

    column.className = 'pg-col'
    media.className = 'pg-col-media'
    captions.className = 'pg-captions'

    rows.forEach(function (row) {
        var rowEl = document.createElement('div')

        rowEl.className = 'pg-row'

        row.forEach(function (spec) {
            var photo = map[spec.id]
            if (!photo || !photo.src) return

            var cell = createCell(App, spec, photo)
            if (!cell) return

            rowEl.appendChild(cell)
            captions.appendChild(createCaption(App, photo.id))
        })

        if (rowEl.childElementCount) media.appendChild(rowEl)
    })

    if (!media.childElementCount) return null

    column.appendChild(media)
    if (captions.childElementCount) column.appendChild(captions)

    return column
}

function renderTrack(ctx) {
    var map = photoMap(ctx.App)
    var fragment = document.createDocumentFragment()

    splitColumns().forEach(function (rows) {
        var node = createColumn(ctx.App, rows, map)
        if (node) fragment.appendChild(node)
    })

    ctx.track.replaceChildren(fragment)
}

function buildLightbox() {
    var el = document.createElement('div')
    el.className = 'pg-lightbox'
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')

    var scrim = document.createElement('div')
    scrim.className = 'pg-lb-scrim'
    scrim.dataset.lbClose = ''

    var frame = document.createElement('figure')
    frame.className = 'pg-lb-frame'

    var img = document.createElement('img')
    img.className = 'pg-lb-img'
    img.alt = ''

    var caption = document.createElement('figcaption')
    caption.className = 'pg-lb-caption'

    var text = document.createElement('span')
    text.className = 'pg-lb-text'

    var source = document.createElement('a')
    source.className = 'pg-lb-source'
    source.target = '_blank'
    source.rel = 'noopener noreferrer'
    source.hidden = true

    var close = document.createElement('button')
    close.type = 'button'
    close.className = 'pg-lb-close'
    close.dataset.lbClose = ''

    caption.appendChild(text)
    caption.appendChild(source)
    frame.appendChild(img)
    frame.appendChild(caption)
    el.appendChild(scrim)
    el.appendChild(frame)
    el.appendChild(close)

    return { el: el, close: close, img: img, text: text, source: source }
}

export default {
    mount(root) {
        const App = window.App
        const track = root.querySelector('[data-track]')
        const stage = root.querySelector('[data-stage]')
        const progressBar = root.querySelector('[data-progress]')

        if (!track || !stage) return { unmount() {} }

        track.classList.toggle('is-aged', agedFilter)

        const ctx = { App: App, track: track }
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
        const narrow = window.matchMedia('(max-width: 720px)')

        let momentumRaf = 0
        let dragging = false
        let dragPointer = null
        let lastX = 0
        let velocity = 0
        let dragMoved = 0
        let captured = false
        let suppressUntil = 0
        let lastTrigger = null
        let currentPhotoId = ''
        let fitRaf = 0
        let disposed = false
        let resizeObserver = null

        const lightbox = buildLightbox()

        function updateProgress() {
            if (!progressBar) return

            var max = track.scrollWidth - track.clientWidth
            var ratio = max > 0 ? track.scrollLeft / max : 0
            progressBar.style.transform = 'scaleX(' + ratio + ')'
        }

        const scheduleProgress = App.utils.debounceRaf(updateProgress)

        /* 先按整栏宽判断行数：不超过三行保持单栏，超过才分到三栏。 */
        function fitCaptions() {
            if (disposed) return

            track.querySelectorAll('.pg-caption-text').forEach(function (text) {
                text.classList.remove('is-multicol')

                var lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 0
                if (lineHeight && text.scrollHeight > lineHeight * 3 + 1) {
                    text.classList.add('is-multicol')
                }
            })
        }

        /* 基准单位先按配置取值，再用舞台剩余高度反算，保证列高不超过最大单位数。 */
        function fitUnit() {
            if (disposed) return

            var rootSize = parseFloat(
                getComputedStyle(document.documentElement).fontSize
            ) || 16
            var basePx = baseUnit * rootSize

            track.style.setProperty('--pg-unit', basePx + 'px')

            if (narrow.matches) {
                var narrowTrackStyle = getComputedStyle(track)
                var row = track.querySelector('.pg-row')
                var tileGap = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0
                var padded = parseFloat(narrowTrackStyle.paddingLeft) +
                    parseFloat(narrowTrackStyle.paddingRight)
                var available = track.clientWidth - padded
                var unit = (available - tileGap * (NARROW_UNIT_LIMIT - 1)) /
                    NARROW_UNIT_LIMIT

                if (isFinite(unit) && unit > 0) {
                    var fitted = Math.max(1, Math.min(basePx, unit))
                    track.style.setProperty('--pg-unit',
                        (Math.floor(fitted * 100) / 100) + 'px')
                }

                fitCaptions()
                updateProgress()
                return
            }

            var stageStyle = getComputedStyle(stage)
            var trackStyle = getComputedStyle(track)
            var available = stage.clientHeight -
                parseFloat(stageStyle.paddingTop) -
                parseFloat(stageStyle.paddingBottom) -
                parseFloat(trackStyle.paddingTop) -
                parseFloat(trackStyle.paddingBottom)
            var limit = basePx

            track.querySelectorAll('.pg-col').forEach(function (column) {
                var media = column.querySelector('.pg-col-media')
                if (!media) return

                var rows = media.querySelectorAll('.pg-row')
                var rowGap = parseFloat(getComputedStyle(media).rowGap) || 0
                var gapTotal = rowGap * Math.max(0, rows.length - 1)
                var scal = media.offsetHeight - gapTotal
                var fixed = column.offsetHeight - media.offsetHeight + gapTotal

                if (scal > 0 && available > fixed) {
                    limit = Math.min(limit, basePx * (available - fixed) / scal)
                }
            })

            limit = Math.max(1, Math.min(basePx, limit))
            track.style.setProperty('--pg-unit', limit + 'px')
            fitCaptions()
            updateProgress()
        }

        function scheduleFit() {
            if (disposed || fitRaf) return

            fitRaf = requestAnimationFrame(function () {
                fitRaf = 0
                fitUnit()
            })
        }

        function syncLabels() {
            var closeText = App.i18n.t('common.lightbox.close') || ''
            var dialogText = App.i18n.t('common.lightbox.aria') || ''

            lightbox.close.textContent = closeText
            lightbox.close.setAttribute('aria-label', closeText)
            lightbox.el.setAttribute('aria-label', dialogText)
        }

        function syncSource(href) {
            if (href) {
                lightbox.source.href = href
                lightbox.source.hidden = false
                lightbox.source.textContent =
                    App.i18n.t('common.lightbox.source') || ''
            } else {
                lightbox.source.hidden = true
                lightbox.source.removeAttribute('href')
                lightbox.source.textContent = ''
            }
        }

        function syncOpenLightbox() {
            if (lightbox.el.hidden || !currentPhotoId) return

            var trigger = findShot(track, currentPhotoId)
            if (!trigger) return

            var img = trigger.querySelector('img')
            if (img) {
                lightbox.img.src = img.currentSrc || img.src
                lightbox.img.alt = img.alt
            }

            lightbox.text.textContent = captionOf(App, currentPhotoId)
            syncSource(trigger.dataset.realHref || '')
        }

        function openLightbox(trigger) {
            if (!lightbox.el.hidden) return

            var img = trigger.querySelector('img')
            if (!img) return

            currentPhotoId = trigger.dataset.photoId || ''
            lastTrigger = trigger

            lightbox.img.src = img.currentSrc || img.src
            lightbox.img.alt = img.alt
            lightbox.text.textContent = captionOf(App, currentPhotoId)
            syncSource(trigger.dataset.realHref || '')

            lightbox.el.hidden = false
            document.documentElement.classList.add('pg-lightbox-open')
            lightbox.close.focus()
        }

        function closeLightbox() {
            if (lightbox.el.hidden) return

            var trigger = lastTrigger
            var id = currentPhotoId

            lightbox.el.hidden = true
            lightbox.img.removeAttribute('src')
            lightbox.img.alt = ''
            document.documentElement.classList.remove('pg-lightbox-open')
            lastTrigger = null
            currentPhotoId = ''

            if (trigger && document.contains(trigger)) {
                trigger.focus()
            } else if (id) {
                var target = findShot(track, id) || track
                target.focus()
            } else {
                track.focus()
            }
        }

        function onLightboxClick(event) {
            if (event.target.closest('[data-lb-close]')) {
                event.preventDefault()
                closeLightbox()
            }
        }

        function onKeydown(event) {
            if (lightbox.el.hidden) return

            if (event.key === 'Escape') {
                event.preventDefault()
                closeLightbox()
                return
            }

            if (event.key !== 'Tab') return

            var items = [lightbox.close]
            if (!lightbox.source.hidden) items.push(lightbox.source)

            var first = items[0]
            var last = items[items.length - 1]

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        function onTrackClick(event) {
            if (Date.now() < suppressUntil) {
                event.preventDefault()
                return
            }

            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

            var shot = event.target.closest('.pg-shot')
            if (!shot || !track.contains(shot)) return

            event.preventDefault()
            openLightbox(shot)
        }

        function onWheel(event) {
            if (narrow.matches) return
            if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
            if (!event.deltaY) return

            event.preventDefault()
            cancelMomentum()
            track.scrollLeft += event.deltaY * (narrow.matches ? 0.7 : 1)
        }

        function onTrackKey(event) {
            var step = Math.max(240, track.clientWidth * 0.8)
            var shot = event.target.closest('.pg-shot')

            if (shot && !shot.hasAttribute('href') &&
                (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                openLightbox(shot)
                return
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault()
                track.scrollBy({ left: step, behavior: 'smooth' })
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                track.scrollBy({ left: -step, behavior: 'smooth' })
            } else if (event.key === 'Home') {
                event.preventDefault()
                track.scrollTo({ left: 0, behavior: 'smooth' })
            } else if (event.key === 'End') {
                event.preventDefault()
                track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' })
            }
        }

        function cancelMomentum() {
            if (momentumRaf) cancelAnimationFrame(momentumRaf)
            momentumRaf = 0
        }

        function startMomentum(value) {
            cancelMomentum()

            var v = Math.max(-48, Math.min(48, value))
            if (Math.abs(v) < 0.4) return

            function step() {
                if (Math.abs(v) < 0.3) {
                    momentumRaf = 0
                    return
                }

                track.scrollLeft += v
                v *= narrow.matches ? 0.9 : 0.94
                momentumRaf = requestAnimationFrame(step)
            }

            momentumRaf = requestAnimationFrame(step)
        }

        /* 链接与图片默认可被原生拖拽，dragstart 会中断 pointer 序列，
         * 故在轨道内一并取消。 */
        function onDragStart(event) {
            event.preventDefault()
        }

        function onPointerDown(event) {
            if (narrow.matches || !finePointer.matches || event.button !== 0) return

            dragging = true
            dragPointer = event.pointerId
            captured = false
            lastX = event.clientX
            velocity = 0
            dragMoved = 0

            cancelMomentum()
        }

        /* 指针捕获会改写后续 click 的目标，故越过拖动阈值后才捕获，
         * 单击图片仍由图片自身接收。 */
        function onPointerMove(event) {
            if (!dragging || event.pointerId !== dragPointer) return

            var dx = event.clientX - lastX
            lastX = event.clientX
            dragMoved += Math.abs(dx)
            velocity = -dx
            track.scrollLeft -= dx

            if (!captured && dragMoved > 4) {
                captured = true
                track.classList.add('is-dragging')

                try {
                    track.setPointerCapture(event.pointerId)
                } catch (e) { /* 忽略：合成事件没有可捕获的指针 */ }
            }
        }

        function onPointerUp(event) {
            if (!dragging || event.pointerId !== dragPointer) return

            dragging = false
            track.classList.remove('is-dragging')

            if (captured && track.hasPointerCapture &&
                track.hasPointerCapture(dragPointer)) {
                track.releasePointerCapture(dragPointer)
            }

            if (dragMoved > 6) {
                suppressUntil = Date.now() + 280
                startMomentum(velocity)
            }

            captured = false
            dragPointer = null
        }

        function rebuild() {
            var left = track.scrollLeft

            renderTrack(ctx)
            fitUnit()
            track.scrollLeft = left
            updateProgress()
            syncLabels()
            syncOpenLightbox()
        }

        const unsubscribeLang = App.i18n.onChange(rebuild)

        syncLabels()
        renderTrack(ctx)
        fitUnit()

        document.body.appendChild(lightbox.el)
        lightbox.el.addEventListener('click', onLightboxClick)
        document.addEventListener('keydown', onKeydown)

        track.addEventListener('click', onTrackClick)
        track.addEventListener('dragstart', onDragStart)
        track.addEventListener('keydown', onTrackKey)
        track.addEventListener('scroll', scheduleProgress, { passive: true })
        track.addEventListener('pointerdown', onPointerDown)
        track.addEventListener('pointermove', onPointerMove)
        track.addEventListener('pointerup', onPointerUp)
        track.addEventListener('pointercancel', onPointerUp)
        stage.addEventListener('wheel', onWheel, { passive: false })
        window.addEventListener('resize', scheduleProgress)
        window.addEventListener('resize', scheduleFit)

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(scheduleFit)
            resizeObserver.observe(stage)
        }

        return {
            unmount() {
                disposed = true
                cancelMomentum()
                scheduleProgress.cancel()

                if (fitRaf) cancelAnimationFrame(fitRaf)
                fitRaf = 0

                if (resizeObserver) {
                    resizeObserver.disconnect()
                    resizeObserver = null
                }

                unsubscribeLang()

                if (captured && dragPointer != null &&
                    track.hasPointerCapture && track.hasPointerCapture(dragPointer)) {
                    track.releasePointerCapture(dragPointer)
                }

                track.removeEventListener('click', onTrackClick)
                track.removeEventListener('dragstart', onDragStart)
                track.removeEventListener('keydown', onTrackKey)
                track.removeEventListener('scroll', scheduleProgress)
                track.removeEventListener('pointerdown', onPointerDown)
                track.removeEventListener('pointermove', onPointerMove)
                track.removeEventListener('pointerup', onPointerUp)
                track.removeEventListener('pointercancel', onPointerUp)
                stage.removeEventListener('wheel', onWheel)
                window.removeEventListener('resize', scheduleProgress)
                window.removeEventListener('resize', scheduleFit)
                document.removeEventListener('keydown', onKeydown)
                lightbox.el.removeEventListener('click', onLightboxClick)

                document.documentElement.classList.remove('pg-lightbox-open')
                lightbox.el.remove()
            }
        }
    }
}
