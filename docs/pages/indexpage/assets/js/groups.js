import { config } from './config.js'
import { announce, captureFocus, escapeHtml, formatText, hostName, pad, restoreFocus, safeUrl } from './dom.js'
import { invalidateStatusIndex, startProbes, statusMarkup } from './status.js'

const texts = config.texts[config.currentLocale]

export function createGroups (state, elements) {
    const focusEntries = [
        { name: 'primary', root: elements.primaryRail, attribute: 'data-parent' },
        { name: 'secondary', root: elements.secondaryRail, attribute: 'data-group' }
    ]

    function renderApps () {
        elements.appsList.innerHTML = state.apps.map(function (app) {
            const description = app.description || ''
            const inner = '<span class="app-name">' + escapeHtml(app.name) + '</span>' +
                '<span class="app-desc">' + escapeHtml(description) + '</span>'
            const url = safeUrl(app.url)
            if (!url) {
                return '<li><span class="app-link">' + inner +
                    '<span class="sr-only">' + escapeHtml(texts.invalidLinkNote) + '</span></span></li>'
            }
            const target = app.target ? ' target="' + escapeHtml(app.target) + '"' : ''
            return '<li><a class="app-link" href="' + escapeHtml(url) + '"' + target + ' rel="noopener noreferrer">' +
                inner + '</a></li>'
        }).join('')
    }

    function railButton (attribute, id, label, count, selected, showCount) {
        return '<button type="button" ' + attribute + '="' + escapeHtml(id) + '" aria-pressed="' +
            (selected ? 'true' : 'false') + '">' +
            '<span>' + escapeHtml(label) + '</span>' +
            (showCount ? '<span class="rail-count" aria-hidden="true">' + count + '</span>' : '') +
            '</button>'
    }

    function revealSelected (rail) {
        const button = rail.querySelector('[aria-pressed="true"]')
        if (!button) return
        const railBox = rail.getBoundingClientRect()
        const box = button.getBoundingClientRect()
        const gap = 22
        if (box.left < railBox.left + gap) rail.scrollLeft -= (railBox.left + gap - box.left)
        else if (box.right > railBox.right - gap) rail.scrollLeft += (box.right - (railBox.right - gap))
    }

    function updateFades (rail) {
        const max = rail.scrollWidth - rail.clientWidth
        rail.classList.toggle('can-left', rail.scrollLeft > 2)
        rail.classList.toggle('can-right', max > 2 && rail.scrollLeft < max - 2)
    }

    function renderRails () {
        const focus = captureFocus(focusEntries)
        const parent = state.parentById.get(state.currentParentId)

        elements.primaryRail.innerHTML = state.parents.map(function (item) {
            return railButton('data-parent', item.id, item.name, item.groups.length, item.id === state.currentParentId, false)
        }).join('')

        elements.secondaryRail.innerHTML = parent ? parent.groups.map(function (group) {
            return railButton('data-group', group.id, group.name, group.sites.length, group.id === state.currentGroupId, true)
        }).join('') : ''

        revealSelected(elements.primaryRail)
        revealSelected(elements.secondaryRail)
        updateFades(elements.primaryRail)
        updateFades(elements.secondaryRail)
        restoreFocus(focus, focusEntries)
    }

    function bindRailInteraction (rail) {
        let drag = null
        let suppressButton = null
        let suppressTimer = 0

        function clearSuppression () {
            suppressButton = null
            if (suppressTimer) {
                window.clearTimeout(suppressTimer)
                suppressTimer = 0
            }
        }

        rail.addEventListener('scroll', function () {
            updateFades(rail)
        })

        rail.addEventListener('wheel', function (event) {
            if (event.ctrlKey) return
            const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey
            if (!horizontal) return
            if (rail.scrollWidth <= rail.clientWidth) return
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
            event.preventDefault()
            rail.scrollLeft += delta
        }, { passive: false })

        rail.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'touch' || event.button !== 0) return
            clearSuppression()
            drag = {
                x: event.clientX,
                left: rail.scrollLeft,
                moved: false,
                button: event.target.closest ? event.target.closest('button') : null
            }
        })

        rail.addEventListener('pointermove', function (event) {
            if (!drag) return
            const delta = event.clientX - drag.x
            if (!drag.moved && Math.abs(delta) > 4) {
                drag.moved = true
                rail.classList.add('is-dragging')
                if (rail.setPointerCapture) {
                    try { rail.setPointerCapture(event.pointerId) } catch (error) {   }
                }
            }
            if (!drag.moved) return
            rail.scrollLeft = drag.left - delta
        })

        function endDrag (armSuppression) {
            if (!drag) return
            const moved = drag.moved
            const button = drag.button
            drag = null
            rail.classList.remove('is-dragging')
            if (!moved || !button || !armSuppression) return
            clearSuppression()
            suppressButton = button
            suppressTimer = window.setTimeout(clearSuppression, 500)
        }

        rail.addEventListener('pointerup', function () {
            endDrag(true)
        })
        rail.addEventListener('pointercancel', function () {
            endDrag(false)
        })

        rail.addEventListener('click', function (event) {
            if (event.detail === 0) return
            if (!suppressButton) return
            const button = suppressButton
            clearSuppression()
            if (!button.contains(event.target)) return
            event.preventDefault()
            event.stopPropagation()
        }, true)

        rail.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
            const buttons = Array.from(rail.querySelectorAll('button'))
            const index = buttons.indexOf(document.activeElement)
            if (index < 0) return
            event.preventDefault()
            let next = index
            if (event.key === 'ArrowRight') next = Math.min(index + 1, buttons.length - 1)
            else if (event.key === 'ArrowLeft') next = Math.max(index - 1, 0)
            else if (event.key === 'Home') next = 0
            else next = buttons.length - 1
            buttons[next].focus()
            revealSelected(rail)
            const box = buttons[next].getBoundingClientRect()
            const railBox = rail.getBoundingClientRect()
            if (box.left < railBox.left) rail.scrollLeft -= (railBox.left - box.left + 16)
            else if (box.right > railBox.right) rail.scrollLeft += (box.right - railBox.right + 16)
            updateFades(rail)
        })
    }

    function selectParent (parentId) {
        const parent = state.parentById.get(parentId)
        if (!parent || !parent.groups.length) return
        selectGroup(parent.groups[0].id)
    }

    function setupRails () {
        elements.primaryRail.addEventListener('click', function (event) {
            const button = event.target.closest('[data-parent]')
            if (button) selectParent(button.getAttribute('data-parent'))
        })
        elements.secondaryRail.addEventListener('click', function (event) {
            const button = event.target.closest('[data-group]')
            if (button) selectGroup(button.getAttribute('data-group'))
        })
        bindRailInteraction(elements.primaryRail)
        bindRailInteraction(elements.secondaryRail)
        window.addEventListener('resize', function () {
            updateFades(elements.primaryRail)
            updateFades(elements.secondaryRail)
        })
    }

    function siteRow (site, index) {
        const inner = '<span class="site-no" aria-hidden="true">' + pad(index + 1) + '</span>' +
            '<span class="site-names">' +
            '<span class="site-name">' + escapeHtml(site.name) + '</span>' +
            '<span class="site-host">' + escapeHtml(hostName(site.url)) + '</span>' +
            '</span>' +
            '<span class="site-desc">' + escapeHtml(site.desc) + '</span>' +
            statusMarkup(site)
        const url = safeUrl(site.url)
        if (!url) {
            return '<li><span class="site-entry">' + inner +
                '<span class="sr-only">' + escapeHtml(texts.invalidLinkNote) + '</span></span></li>'
        }
        return '<li>' +
            '<a class="site-entry" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
            inner +
            '</a>' +
            '</li>'
    }

    function renderGroup (group) {
        const parent = state.parentById.get(group.parentId)
        elements.panel.setAttribute('aria-busy', 'false')
        elements.panel.innerHTML =
            '<header class="group-head">' +
            '<p class="sr-only">' + escapeHtml(texts.groupOwner) + escapeHtml(parent.name) + '</p>' +
            '<h2 class="group-title" id="group-title">' + escapeHtml(group.name) + '</h2>' +
            '</header>' +
            '<ol class="site-list">' + group.sites.map(siteRow).join('') + '</ol>'
        elements.panel.setAttribute('aria-labelledby', 'group-title')
        elements.panel.removeAttribute('aria-label')
        invalidateStatusIndex()
    }

    function syncUrl (groupId) {
        const url = new URL(window.location.href)
        url.searchParams.set('group', groupId)
        window.history.replaceState(null, '', url.href)
    }

    function selectGroup (groupId, options) {
        const group = state.groupById.get(groupId)
        if (!group) return false
        const settings = options || {}
        const changed = state.currentGroupId !== groupId
        state.currentParentId = group.parentId
        state.currentGroupId = group.id
        renderRails()
        renderGroup(group)
        startProbes(group)
        if (settings.sync !== false) syncUrl(group.id)
        if (changed && settings.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' })
        if (settings.announce !== false) {
            announce(formatText(texts.switchAnnounce, {
                parent: group.parentName,
                group: group.name,
                count: group.sites.length
            }))
        }
        return true
    }

    return { renderApps, setupRails, selectGroup }
}
