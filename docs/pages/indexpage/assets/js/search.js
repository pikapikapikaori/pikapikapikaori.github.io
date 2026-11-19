import { config } from './config.js'
import { announce, escapeHtml, hostName, isEditable, openUrl, pad } from './dom.js'
import { invalidateStatusIndex, statusForSite, statusInner } from './status.js'

const texts = config.texts[config.currentLocale]

export function setupSearch (state, elements, selectGroup) {
    const root = document.querySelector('[data-search]')
    const input = elements.searchInput
    const panel = elements.searchResults
    const list = elements.searchList
    const note = document.getElementById('search-note')

    function normalizeWhitespace (value) {
        return String(value == null ? '' : value).replace(/\u3000/g, ' ')
    }

    function foldText (text) {
        const source = normalizeWhitespace(text)
        let output = ''
        for (let index = 0; index < source.length; index++) {
            const lower = source.charAt(index).toLowerCase()
            output += config.fold[lower] || lower
        }
        return output
    }

    function scoreField (query, text) {
        const needle = foldText(query)
        if (!needle) return -1
        const haystack = foldText(text)
        let from = 0
        let previous = -2
        let score = 0
        for (let index = 0; index < needle.length; index++) {
            const found = haystack.indexOf(needle.charAt(index), from)
            if (found < 0) return -1
            if (found === previous + 1) score += 3
            else if (found === 0) score += 5
            else score += 1
            previous = found
            from = found + 1
        }
        return score * 100 - haystack.length
    }

    function bestScore (query, fields) {
        let best = -1
        for (let index = 0; index < fields.length; index++) {
            const field = fields[index]
            if (!field) continue
            const value = scoreField(query, field)
            if (value > best) best = value
        }
        return best
    }

    function highlight (text, query) {
        const source = String(text == null ? '' : text)
        const needle = foldText(query)
        if (!needle) return escapeHtml(source)
        /* 按 code point 切分，代理对不被拆开，标记也按整字判断。 */
        const chars = Array.from(source)
        const foldedChars = chars.map(function (char) { return foldText(char) })
        const needleChars = Array.from(needle)
        const mask = new Array(chars.length).fill(false)
        let from = 0
        for (let index = 0; index < needleChars.length; index++) {
            let found = -1
            for (let cursor = from; cursor < foldedChars.length; cursor++) {
                if (foldedChars[cursor].indexOf(needleChars[index]) !== -1) {
                    found = cursor
                    break
                }
            }
            if (found < 0) return escapeHtml(source)
            mask[found] = true
            from = found + 1
        }
        let output = ''
        let index = 0
        while (index < chars.length) {
            if (!mask[index]) {
                output += escapeHtml(chars[index])
                index++
                continue
            }
            let end = index
            while (end < chars.length && mask[end]) end++
            output += '<mark>' + escapeHtml(chars.slice(index, end).join('')) + '</mark>'
            index = end
        }
        return output
    }

    const providerItems = state.providers.map(function (provider) {
        return {
            provider: provider,
            prefix: provider.prefix,
            name: provider.name,
            category: provider.category
        }
    })
    const groupItems = state.groups.map(function (group) {
        return {
            group: group,
            name: group.name,
            parentName: group.parentName,
            count: group.sites.length
        }
    })
    const siteItems = state.sites.map(function (site) {
        return {
            site: site,
            name: site.name,
            desc: site.desc,
            host: hostName(site.url),
            parentName: site.parentName,
            groupName: site.groupName
        }
    })

    let rows = []
    let selected = -1
    let selectionSource = ''
    let solo = false
    let hintAnnounced = false
    let emptyAnnounced = false

    function isOpen () {
        return !panel.hidden
    }

    /* 面板贴到视口下缘：以自身顶部位置换算 100dvh 的可用高度。 */
    function syncPanelMetrics () {
        panel.style.setProperty('--results-top', panel.getBoundingClientRect().top + 'px')
    }

    function openPanel () {
        panel.hidden = false
        syncPanelMetrics()
        input.setAttribute('aria-expanded', 'true')
        document.body.classList.add('is-searching')
        if (elements.main) elements.main.inert = true
        if (elements.headUnder) elements.headUnder.inert = true
    }

    function closePanel () {
        panel.hidden = true
        input.setAttribute('aria-expanded', 'false')
        input.removeAttribute('aria-activedescendant')
        input.removeAttribute('aria-describedby')
        selected = -1
        selectionSource = ''
        hintAnnounced = false
        emptyAnnounced = false
        document.body.classList.remove('is-searching')
        if (elements.main) elements.main.inert = false
        if (elements.headUnder) elements.headUnder.inert = false
    }

    function searchProviders (query) {
        return providerItems.map(function (item) {
            return { item: item, score: bestScore(query, [item.prefix + ' ' + item.name, item.prefix, item.name, item.category]) }
        }).filter(function (hit) { return hit.score >= 0 }).sort(function (a, b) {
            return b.score - a.score
        }).slice(0, config.searchLimit.providers).map(function (hit) { return hit.item })
    }

    function searchGroups (query) {
        return groupItems.map(function (item) {
            return { item: item, score: bestScore(query, [item.name, item.parentName]) }
        }).filter(function (hit) { return hit.score >= 0 }).sort(function (a, b) {
            return b.score - a.score
        }).slice(0, config.searchLimit.groups).map(function (hit) { return hit.item })
    }

    function searchSites (query) {
        return siteItems.map(function (item) {
            return { item: item, score: bestScore(query, [item.name, item.host, item.desc, item.groupName]) }
        }).filter(function (hit) { return hit.score >= 0 }).sort(function (a, b) {
            return b.score - a.score
        }).slice(0, config.searchLimit.sites).map(function (hit) { return hit.item })
    }

    function section (label, rowsHtml, count, ariaLabel) {
        return '<div class="result-section" role="group" aria-label="' + escapeHtml(ariaLabel || label) + '">' +
            '<p class="result-head" aria-hidden="true"><span>' + escapeHtml(label) + '</span><span>' + count + '</span></p>' +
            rowsHtml +
            '</div>'
    }

    function renderProviderRow (item, query, index) {
        return '<div class="result-row" role="option" id="search-option-' + index + '" data-index="' + index + '" aria-selected="false">' +
            '<span class="result-no" aria-hidden="true">' + pad(index + 1) + '</span>' +
            '<span class="result-main">' +
            '<span class="result-title">' + highlight(item.name, query) + '</span>' +
            '<span class="result-sub">' + escapeHtml(texts.providerRowAction) + '</span>' +
            '</span>' +
            '<span class="result-meta">' + escapeHtml(item.category) + '</span>' +
            '</div>'
    }

    function renderProviderHint (item, query) {
        return '<div class="result-row result-hint" id="search-hint">' +
            '<span class="result-no" aria-hidden="true"></span>' +
            '<span class="result-main">' +
            '<span class="result-title">' + highlight(item.name, query) + '</span>' +
            '<span class="result-sub">' + escapeHtml(texts.providerHint) + '</span>' +
            '</span>' +
            '<span class="result-meta">' + escapeHtml(item.category) + '</span>' +
            '</div>'
    }

    function renderEmpty () {
        return '<p class="result-empty" id="search-empty">' + escapeHtml(texts.emptyResults) + '</p>'
    }

    /* 显示与打开共用这一处拼装；显示传原文关键词，打开传编码后的值。 */
    function providerAddress (provider, keyword) {
        return keyword ? provider.query + keyword : provider.url
    }

    function renderCommandRow (command, index) {
        const display = providerAddress(command.provider, command.keyword).replace(/^https?:\/\//, '')
        return '<div class="result-row" role="option" id="search-option-' + index + '" data-index="' + index + '" aria-selected="false">' +
            '<span class="result-no" aria-hidden="true">' + pad(index + 1) + '</span>' +
            '<span class="result-main">' +
            '<span class="result-title"><span class="command-lead">' + escapeHtml(texts.commandLead) + '</span>' +
            '<span class="command-name">' + escapeHtml(command.provider.name) + '</span>' +
            '<span class="command-lead">' + escapeHtml(texts.commandJoin) + '</span>' + highlight(command.keyword, command.keyword) + '</span>' +
            '<span class="result-sub">' + escapeHtml(texts.commandAddress) + escapeHtml(display) + '</span>' +
            '</span>' +
            '<span class="result-meta">' + escapeHtml(command.provider.category) + '</span>' +
            '</div>'
    }

    function renderGroupRow (item, query, index) {
        return '<div class="result-row" role="option" id="search-option-' + index + '" data-index="' + index + '" aria-selected="false">' +
            '<span class="result-no" aria-hidden="true">' + pad(index + 1) + '</span>' +
            '<span class="result-main">' +
            '<span class="result-title">' + highlight(item.parentName, query) +
            '<span aria-hidden="true">' + escapeHtml(texts.separator) + '</span>' + highlight(item.name, query) + '</span>' +
            '<span class="result-sub">' + escapeHtml(texts.groupRowHint) + '</span>' +
            '</span>' +
            '<span class="result-meta">' + item.count + escapeHtml(texts.groupCountUnit) + '</span>' +
            '</div>'
    }

    function renderSiteRow (item, query, index) {
        const status = statusForSite(item.site)
        return '<div class="result-row" role="option" id="search-option-' + index + '" data-index="' + index + '" aria-selected="false">' +
            '<span class="result-no" aria-hidden="true">' + pad(index + 1) + '</span>' +
            '<span class="result-main">' +
            '<span class="result-title">' + highlight(item.name, query) + '</span>' +
            '<span class="result-sub">' + highlight(item.desc, query) + '</span>' +
            '<span class="result-path">' + highlight(item.parentName, query) + escapeHtml(texts.separator) + highlight(item.groupName, query) + '</span>' +
            '</span>' +
            '<span class="result-status" data-tone="' + status.tone + '" data-status-url="' +
            escapeHtml(item.site.url) + '" title="' + escapeHtml(texts.statusTitle + status.label) + '">' +
            statusInner(status) +
            '</span>' +
            '</div>'
    }

    function updateSelection () {
        const options = list.querySelectorAll('[role="option"]')
        Array.prototype.forEach.call(options, function (option, index) {
            const active = selected >= 0 && index === selected
            option.classList.toggle('is-selected', active)
            const chosen = active || (solo && index === 0)
            option.setAttribute('aria-selected', chosen ? 'true' : 'false')
        })
        if (selected >= 0 && options.length) {
            const current = options[Math.min(selected, options.length - 1)]
            input.setAttribute('aria-activedescendant', current.id)
            const panelBox = panel.getBoundingClientRect()
            const rowBox = current.getBoundingClientRect()
            if (rowBox.top < panelBox.top) panel.scrollTop -= (panelBox.top - rowBox.top)
            else if (rowBox.bottom > panelBox.bottom) panel.scrollTop += (rowBox.bottom - panelBox.bottom)
            return
        }
        if (solo && options.length) {
            input.setAttribute('aria-activedescendant', options[0].id)
            return
        }
        input.removeAttribute('aria-activedescendant')
    }

    function update () {
        input.removeAttribute('aria-describedby')
        const value = String(input.value).trimStart()
        if (value.charAt(0) !== '/') {
            rows = []
            solo = false
            hintAnnounced = false
            closePanel()
            return
        }
        const query = value.slice(1).trim()
        if (!query) {
            rows = []
            solo = false
            hintAnnounced = false
            closePanel()
            return
        }

        const command = parseProviderInput(value)
        if (command && command.keyword) {
            rows = [{ kind: 'command', provider: command.provider, keyword: command.keyword }]
            selected = -1
            selectionSource = ''
            solo = true
            hintAnnounced = false
            emptyAnnounced = false
            list.innerHTML = section(texts.sectionAction, renderCommandRow(command, 0), 1)
            note.innerHTML = ''
            invalidateStatusIndex()
            openPanel()
            updateSelection()
            return
        }
        if (command) {
            /* 前缀已完整时只给提示：它不是候选项，回车仍按前缀规则打开引擎首页。 */
            const item = providerItems.find(function (candidate) {
                return candidate.provider === command.provider
            })
            rows = []
            selected = -1
            selectionSource = ''
            solo = false
            list.innerHTML = ''
            note.innerHTML = item ? renderProviderHint(item, query) : renderEmpty()
            invalidateStatusIndex()
            if (item) {
                emptyAnnounced = false
                input.setAttribute('aria-describedby', 'search-hint')
                if (!hintAnnounced) {
                    hintAnnounced = true
                    announce(texts.providerHint)
                }
            } else {
                input.setAttribute('aria-describedby', 'search-empty')
                if (!emptyAnnounced) {
                    emptyAnnounced = true
                    announce(texts.emptyResults)
                }
            }
            openPanel()
            updateSelection()
            return
        }
        hintAnnounced = false

        const providers = searchProviders(query)
        const groups = searchGroups(query)
        const sites = searchSites(query)
        rows = providers.map(function (item) { return { kind: 'provider', item: item } })
            .concat(groups.map(function (item) { return { kind: 'group', item: item } }))
            .concat(sites.map(function (item) { return { kind: 'site', item: item } }))
        selected = -1
        selectionSource = ''
        solo = false

        let index = 0
        let html = ''
        if (providers.length) {
            html += section(texts.sectionProvider, providers.map(function (item) {
                return renderProviderRow(item, query, index++)
            }).join(''), providers.length)
        }
        if (groups.length) {
            html += section(texts.sectionGroup, groups.map(function (item) {
                return renderGroupRow(item, query, index++)
            }).join(''), groups.length, texts.sectionGroupAria)
        }
        if (sites.length) {
            html += section(texts.sectionSite, sites.map(function (item) {
                return renderSiteRow(item, query, index++)
            }).join(''), sites.length)
        }

        list.innerHTML = html
        note.innerHTML = html ? '' : renderEmpty()
        if (!html) {
            input.setAttribute('aria-describedby', 'search-empty')
            if (!emptyAnnounced) {
                emptyAnnounced = true
                announce(texts.emptyResults)
            }
        } else {
            emptyAnnounced = false
        }
        invalidateStatusIndex()
        openPanel()
        updateSelection()
    }

    function clearSearch () {
        input.value = ''
        rows = []
        selected = -1
        solo = false
        closePanel()
        input.focus()
    }

    /* 前缀前的空白先去掉；分隔符接受任意空白与全角空格；
       分隔符之后的内容才是关键词，首尾空白同样去掉。 */
    function parseProviderInput (value) {
        const match = config.providerPrefixPattern.exec(String(value == null ? '' : value).trimStart())
        if (!match) return null
        const provider = state.providerByPrefix.get('/' + match[1].toLowerCase())
        if (!provider) return null
        return {
            provider: provider,
            keyword: normalizeWhitespace(match[2] || '').trim()
        }
    }

    function runProvider (command) {
        const keyword = command.keyword ? encodeURIComponent(command.keyword) : ''
        if (openUrl(providerAddress(command.provider, keyword), texts.invalidLink)) clearSearch()
    }

    function findProviderByName (name) {
        const wanted = String(name).toLowerCase()
        for (let index = 0; index < state.providers.length; index++) {
            if (String(state.providers[index].name).toLowerCase() === wanted) return state.providers[index]
        }
        return null
    }

    function runGoogle (text) {
        const google = findProviderByName('Google')
        if (!google || !google.query) {
            announce(texts.googleMissing)
            return
        }
        if (openUrl(google.query + encodeURIComponent(text), texts.invalidLink)) clearSearch()
    }

    function activate () {
        const row = rows[selected]
        if (!row) return
        if (row.kind === 'group') {
            selectionSource = ''
            clearSearch()
            selectGroup(row.item.group.id, { scroll: true })
            return
        }
        if (row.kind === 'command') {
            runProvider({ provider: row.provider, keyword: row.keyword })
            return
        }
        if (row.kind === 'provider') {
            const value = row.item.prefix + ' '
            input.value = value
            selected = -1
            selectionSource = ''
            input.focus()
            input.setSelectionRange(value.length, value.length)
            update()
            return
        }
        if (openUrl(row.item.site.url, texts.invalidLink)) clearSearch()
    }

    function keydown (event) {
        if (event.isComposing || event.keyCode === 229) return

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!isOpen()) {
                if (!input.value) return
                update()
            }
            if (!rows.length) return
            event.preventDefault()
            if (event.key === 'ArrowDown') selected = selected < 0 ? 0 : Math.min(selected + 1, rows.length - 1)
            else selected = selected < 0 ? rows.length - 1 : Math.max(selected - 1, 0)
            selectionSource = 'keyboard'
            updateSelection()
            return
        }

        if (event.key === 'Tab' && !event.shiftKey && isOpen()) {
            const row = selected >= 0 ? rows[selected] : null
            if (row && selectionSource === 'keyboard') {
                event.preventDefault()
                activate()
                return
            }
            const command = parseProviderInput(input.value)
            if (command && command.keyword === '') {
                event.preventDefault()
                input.setSelectionRange(input.value.length, input.value.length)
                return
            }
            closePanel()
            return
        }

        if (event.key === 'Escape') {
            if (isOpen()) {
                event.preventDefault()
                closePanel()
                return
            }
            if (input.value) {
                event.preventDefault()
                input.value = ''
                rows = []
                selected = -1
                selectionSource = ''
            }
            return
        }

        if (event.key !== 'Enter') return
        if (isOpen() && rows.length && selected >= 0) {
            event.preventDefault()
            activate()
            return
        }
        const command = parseProviderInput(input.value)
        if (command) {
            event.preventDefault()
            runProvider(command)
            return
        }
        const text = input.value.trim()
        if (text) {
            event.preventDefault()
            runGoogle(text)
        }
    }

    input.addEventListener('input', function () {
        selected = -1
        selectionSource = ''
        update()
    })
    input.addEventListener('focus', function () {
        if (input.value.charAt(0) === '/') {
            selected = -1
            selectionSource = ''
            update()
        }
    })
    input.addEventListener('keydown', keydown)

    panel.addEventListener('pointerdown', function (event) {
        event.preventDefault()
    })
    panel.addEventListener('click', function (event) {
        const option = event.target.closest('[role="option"]')
        if (!option) return
        selected = Number(option.getAttribute('data-index'))
        selectionSource = 'pointer'
        updateSelection()
        activate()
    })
    panel.addEventListener('pointerover', function (event) {
        if (event.pointerType !== 'mouse') return
        const option = event.target.closest('[role="option"]')
        if (!option) return
        const index = Number(option.getAttribute('data-index'))
        selectionSource = 'pointer'
        if (index === selected) return
        selected = index
        updateSelection()
    })
    panel.addEventListener('pointerleave', function () {
        if (selected < 0) return
        selected = -1
        selectionSource = ''
        updateSelection()
    })

    function refreshPanelMetrics () {
        if (isOpen()) syncPanelMetrics()
    }

    window.addEventListener('resize', refreshPanelMetrics)
    window.addEventListener('scroll', refreshPanelMetrics, { passive: true })

    document.addEventListener('pointerdown', function (event) {
        if (!root.contains(event.target)) closePanel()
    })
    root.addEventListener('focusout', function (event) {
        if (event.relatedTarget && root.contains(event.relatedTarget)) return
        closePanel()
    })

    document.addEventListener('keydown', function (event) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
        if (event.key !== '/') return
        if (isEditable(event.target)) return
        event.preventDefault()
        input.focus()
        if (input.value === '') input.value = '/'
        else if (input.value.charAt(0) !== '/') input.value = '/' + input.value
        selected = -1
        selectionSource = ''
        input.setSelectionRange(input.value.length, input.value.length)
        update()
    })
}
