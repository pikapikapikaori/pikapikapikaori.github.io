import {
    agedFilter, baseUnit, columns, maxHeightUnits, narrowColumns, narrowUnitLimit
} from './config.js'

function captionOf(App, id) {
    const table = App.photoCaptions && App.photoCaptions[App.i18n.get()]
    const caption = table && table[id]

    return caption || App.i18n.t('common.untitled') || ''
}

function photoMap(App) {
    const map = Object.create(null)

    App.photos.all().forEach(function (photo) {
        if (photo && photo.id) map[photo.id] = photo
    })

    return map
}

function safePosition(value) {
    return typeof value === 'string' && /^[-\w.%\s]+$/.test(value) ? value : ''
}

function unitValue(value) {
    return typeof value === 'number' && isFinite(value) && value > 0 ? value : 0
}

function findShot(track, id) {
    const shots = track.querySelectorAll('.pg-shot')

    for (let i = 0; i < shots.length; i++) {
        if (shots[i].dataset.photoId === id) return shots[i]
    }

    return null
}

function createShot(App, spec, photo) {
    const caption = captionOf(App, photo.id)
    const link = document.createElement('a')
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

    const img = document.createElement('img')
    img.src = photo.src
    img.alt = caption
    img.loading = 'lazy'
    img.decoding = 'async'
    img.draggable = false

    const position = safePosition(spec.position)
    if (position) img.style.objectPosition = position

    link.appendChild(img)
    return link
}

function createCaption(App, id) {
    const caption = document.createElement('p')
    const text = document.createElement('span')

    caption.className = 'pg-caption'
    text.className = 'pg-caption-text'
    text.textContent = captionOf(App, id)
    caption.appendChild(text)

    return caption
}

function createCell(App, spec, photo) {
    const cell = document.createElement('figure')
    const width = unitValue(spec.width)
    const height = unitValue(spec.height)

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

function splitColumns() {
    const result = []

    columns.forEach(function (column) {
        let rows = []
        let used = 0
        const previous = []

        ;(column.rows || []).forEach(function (row) {
            const items = Array.isArray(row) ? row : []

            if (!items.length) return

            const height = rowHeightUnits(items)

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
    const column = document.createElement('div')
    const media = document.createElement('div')
    const captions = document.createElement('div')

    column.className = 'pg-col'
    media.className = 'pg-col-media'
    captions.className = 'pg-captions'

    rows.forEach(function (row) {
        const rowEl = document.createElement('div')

        rowEl.className = 'pg-row'

        row.forEach(function (spec) {
            const photo = map[spec.id]
            if (!photo || !photo.src) return

            const cell = createCell(App, spec, photo)
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
    const map = photoMap(ctx.App)
    const fragment = document.createDocumentFragment()
    const groups = ctx.narrow
        ? narrowColumns.map(function (column) { return column.rows })
        : splitColumns()

    groups.forEach(function (rows) {
        const node = createColumn(ctx.App, rows, map)
        if (node) fragment.appendChild(node)
    })

    ctx.track.replaceChildren(fragment)
}

function buildLightbox() {
    const el = document.createElement('div')
    el.className = 'pg-lightbox'
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')

    const scrim = document.createElement('div')
    scrim.className = 'pg-lb-scrim'
    scrim.dataset.lbClose = ''

    const frame = document.createElement('figure')
    frame.className = 'pg-lb-frame'

    const img = document.createElement('img')
    img.className = 'pg-lb-img'
    img.alt = ''

    const caption = document.createElement('figcaption')
    caption.className = 'pg-lb-caption'

    const text = document.createElement('span')
    text.className = 'pg-lb-text'

    const source = document.createElement('a')
    source.className = 'pg-lb-source'
    source.target = '_blank'
    source.rel = 'noopener noreferrer'
    source.hidden = true

    const close = document.createElement('button')
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

        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
        const narrow = window.matchMedia('screen and (max-width: 768px)')
        const ctx = { App: App, track: track, narrow: narrow.matches }

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

            const max = track.scrollWidth - track.clientWidth
            const ratio = max > 0 ? track.scrollLeft / max : 0
            progressBar.style.transform = 'scaleX(' + ratio + ')'
        }

        const scheduleProgress = App.utils.debounceRaf(updateProgress)

        function fitCaptions() {
            if (disposed) return

            track.querySelectorAll('.pg-caption-text').forEach(function (text) {
                text.classList.remove('is-multicol')

                const lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 0
                if (lineHeight && text.scrollHeight > lineHeight * 3 + 1) {
                    text.classList.add('is-multicol')
                }
            })
        }

        function fitUnit() {
            if (disposed) return

            const rootSize = parseFloat(
                getComputedStyle(document.documentElement).fontSize
            ) || 16
            const basePx = baseUnit * rootSize

            track.style.setProperty('--pg-unit', basePx + 'px')

            if (narrow.matches) {
                const narrowTrackStyle = getComputedStyle(track)
                const row = track.querySelector('.pg-row')
                const tileGap = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0
                const padded = parseFloat(narrowTrackStyle.paddingLeft) +
                    parseFloat(narrowTrackStyle.paddingRight)
                const available = track.clientWidth - padded
                const unit = (available - tileGap * (narrowUnitLimit - 1)) /
                    narrowUnitLimit

                if (isFinite(unit) && unit > 0) {
                    const fitted = Math.max(1, Math.min(basePx, unit))
                    track.style.setProperty('--pg-unit',
                        (Math.floor(fitted * 100) / 100) + 'px')
                }

                fitCaptions()
                updateProgress()
                return
            }

            function measureLimit(currentUnit) {
                const stageStyle = getComputedStyle(stage)
                const trackStyle = getComputedStyle(track)
                let available = stage.clientHeight -
                    parseFloat(stageStyle.paddingTop) -
                    parseFloat(stageStyle.paddingBottom) -
                    parseFloat(trackStyle.paddingTop) -
                    parseFloat(trackStyle.paddingBottom)

                if (stage.clientHeight < 300) {
                    available = stage.clientHeight -
                        parseFloat(stageStyle.paddingTop) - 2
                }

                let next = basePx

                track.querySelectorAll('.pg-col').forEach(function (column) {
                    const media = column.querySelector('.pg-col-media')
                    if (!media) return

                    const rows = media.querySelectorAll('.pg-row')
                    const rowGap = parseFloat(getComputedStyle(media).rowGap) || 0
                    const gapTotal = rowGap * Math.max(0, rows.length - 1)
                    const scal = media.offsetHeight - gapTotal
                    const fixed = column.offsetHeight - media.offsetHeight + gapTotal

                    if (scal > 0 && available > fixed) {
                        next = Math.min(next,
                            currentUnit * (available - fixed) / scal)
                    }
                })

                return Math.max(1, Math.min(basePx, next))
            }

            let limit = basePx

            /* 缩小单位后 caption 可能换行并增高，需要按新宽度再量一次。 */
            for (let pass = 0; pass < 4; pass += 1) {
                track.style.setProperty('--pg-unit', limit + 'px')
                fitCaptions()

                const next = measureLimit(limit)
                if (next >= limit - .05) break
                limit = next
            }

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
            const closeText = App.i18n.t('common.lightbox.close') || ''
            const dialogText = App.i18n.t('common.lightbox.aria') || ''

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

            const trigger = findShot(track, currentPhotoId)
            if (!trigger) return

            const img = trigger.querySelector('img')
            if (img) {
                lightbox.img.src = img.currentSrc || img.src
                lightbox.img.alt = img.alt
            }

            lightbox.text.textContent = captionOf(App, currentPhotoId)
            syncSource(trigger.dataset.realHref || '')
        }

        function openLightbox(trigger) {
            if (!lightbox.el.hidden) return

            const img = trigger.querySelector('img')
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

            const trigger = lastTrigger
            const id = currentPhotoId

            lightbox.el.hidden = true
            lightbox.img.removeAttribute('src')
            lightbox.img.alt = ''
            document.documentElement.classList.remove('pg-lightbox-open')
            lastTrigger = null
            currentPhotoId = ''

            if (trigger && document.contains(trigger)) {
                trigger.focus()
            } else if (id) {
                const target = findShot(track, id) || track
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

            const items = [lightbox.close]
            if (!lightbox.source.hidden) items.push(lightbox.source)

            const first = items[0]
            const last = items[items.length - 1]

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

            const shot = event.target.closest('.pg-shot')
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
            const step = Math.max(240, track.clientWidth * 0.8)
            const shot = event.target.closest('.pg-shot')
            const opens = shot && (event.key === 'Enter' || event.key === ' ')

            if (opens && (ctx.narrow || !shot.hasAttribute('href'))) {
                event.preventDefault()
                openLightbox(shot)
                return
            }

            if (ctx.narrow) return

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

            let v = Math.max(-48, Math.min(48, value))
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

        function onPointerMove(event) {
            if (!dragging || event.pointerId !== dragPointer) return

            const dx = event.clientX - lastX
            lastX = event.clientX
            dragMoved += Math.abs(dx)
            velocity = -dx
            track.scrollLeft -= dx

            if (!captured && dragMoved > 4) {
                captured = true
                track.classList.add('is-dragging')

                try {
                    track.setPointerCapture(event.pointerId)
                } catch (e) {   }
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

        function resetDrag() {
            if (captured && dragPointer != null && track.hasPointerCapture &&
                track.hasPointerCapture(dragPointer)) {
                track.releasePointerCapture(dragPointer)
            }

            dragging = false
            captured = false
            dragPointer = null
            track.classList.remove('is-dragging')
        }

        function rebuild() {
            const left = track.scrollLeft

            renderTrack(ctx)
            fitUnit()
            track.scrollLeft = left
            updateProgress()
            syncLabels()
            syncOpenLightbox()
        }

        function onNarrowChange() {
            if (ctx.narrow === narrow.matches) return

            cancelMomentum()
            resetDrag()

            if (fitRaf) cancelAnimationFrame(fitRaf)
            fitRaf = 0

            ctx.narrow = narrow.matches
            track.scrollLeft = 0
            renderTrack(ctx)
            fitUnit()
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
        narrow.addEventListener('change', onNarrowChange)
        window.addEventListener('resize', onNarrowChange)
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
                narrow.removeEventListener('change', onNarrowChange)
                window.removeEventListener('resize', onNarrowChange)
                resetDrag()

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
