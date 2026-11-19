import { config } from './config.js'
import { announce, escapeHtml, formatText } from './dom.js'
import { createGroups } from './groups.js'
import { setupSearch } from './search.js'
import { readStatusCache } from './status.js'
import { setupTheme } from './theme.js'

const texts = config.texts[config.currentLocale]

const state = {
    parents: [],
    groups: [],
    sites: [],
    providers: [],
    apps: [],
    parentById: new Map(),
    groupById: new Map(),
    providerByPrefix: new Map(),
    currentParentId: '',
    currentGroupId: ''
}

let elements = null

function cacheElements () {
    elements = {
        siteTitle: document.getElementById('site-title'),
        description: document.querySelector('meta[name="description"]'),
        primaryRail: document.getElementById('primary-rail'),
        secondaryRail: document.getElementById('secondary-rail'),
        railRolePrimary: document.getElementById('rail-role-primary'),
        railRoleSecondary: document.getElementById('rail-role-secondary'),
        toc: document.querySelector('.toc'),
        panel: document.getElementById('group-panel'),
        main: document.getElementById('main'),
        appsSection: document.querySelector('.apps'),
        appsTitle: document.getElementById('apps-title'),
        appsList: document.getElementById('apps-list'),
        greeting: document.getElementById('greeting'),
        todaySeparator: document.querySelector('.today-sep'),
        todayDate: document.getElementById('today-date'),
        copyright: document.getElementById('copyright'),
        searchLabel: document.querySelector('.search-label'),
        searchInput: document.getElementById('search-input'),
        searchResults: document.getElementById('search-results'),
        searchList: document.getElementById('search-list'),
        headUnder: document.querySelector('[data-head-under]'),
        themeSwitch: document.getElementById('theme-switch'),
        themeMeta: document.querySelector('meta[name="theme-color"]'),
        themeButtons: Array.prototype.slice.call(document.querySelectorAll('#theme-switch button')),
        newWindowNote: document.getElementById('new-window-note'),
        loadingNote: document.getElementById('loading-note'),
        live: document.getElementById('live-region')
    }
}

function fillTexts () {
    document.title = texts.documentTitle
    if (elements.description) elements.description.setAttribute('content', texts.description)
    if (elements.siteTitle) elements.siteTitle.textContent = texts.siteTitle
    if (elements.themeSwitch) elements.themeSwitch.setAttribute('aria-label', texts.themeGroup)
    elements.themeButtons.forEach(function (button) {
        button.textContent = texts.themeLabels[button.getAttribute('data-theme-mode')] || ''
    })
    if (elements.searchLabel) elements.searchLabel.textContent = texts.searchLabel
    if (elements.searchInput) elements.searchInput.setAttribute('placeholder', texts.searchPlaceholder)
    if (elements.searchList) elements.searchList.setAttribute('aria-label', texts.searchResultsLabel)
    if (elements.appsTitle) elements.appsTitle.textContent = texts.personalTitle
    if (elements.railRolePrimary) elements.railRolePrimary.textContent = texts.railRolePrimary
    if (elements.railRoleSecondary) elements.railRoleSecondary.textContent = texts.railRoleSecondary
    if (elements.toc) elements.toc.setAttribute('aria-label', texts.tocLabel)
    if (elements.primaryRail) elements.primaryRail.setAttribute('aria-label', texts.railLabelPrimary)
    if (elements.secondaryRail) elements.secondaryRail.setAttribute('aria-label', texts.railLabelSecondary)
    if (elements.panel) elements.panel.setAttribute('aria-label', texts.groupPanelLabel)
    if (elements.newWindowNote) elements.newWindowNote.textContent = texts.newWindowNote
    if (elements.loadingNote) elements.loadingNote.textContent = texts.loading
    if (elements.todaySeparator) elements.todaySeparator.textContent = texts.todaySeparator
}

function greetingFor (hour) {
    for (let index = 0; index < texts.greeting.length; index++) {
        if (hour < texts.greeting[index].until) return texts.greeting[index].text
    }
    return texts.greeting[texts.greeting.length - 1].text
}

function fillToday () {
    const now = new Date()
    const date = texts.date
    elements.greeting.textContent = greetingFor(now.getHours())
    elements.todayDate.textContent = now.getFullYear() + date.year + (now.getMonth() + 1) + date.month +
        now.getDate() + date.day + date.weekday + date.weekdays[now.getDay()]
    elements.todayDate.setAttribute('datetime', now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'))
    elements.copyright.textContent = formatText(texts.copyright, { year: now.getFullYear() })
}

/* 只有吸附层会遮住焦点目标，故以其高度写入 --head-height，供 scroll-margin-top 使用。
   保留小数：取整会让焦点目标顶部被吸附层下缘盖住不足 1px。 */
function setupHeadOffset () {
    const head = document.querySelector('[data-head-stick]')
    if (!head) return
    const root = document.documentElement
    const sync = function () {
        root.style.setProperty('--head-height', head.getBoundingClientRect().height + 'px')
    }
    if (window.ResizeObserver) new ResizeObserver(sync).observe(head)
    window.addEventListener('resize', sync)
    sync()
}

function fetchJson (path) {
    return fetch(path, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
    })
}

function optionalJson (path) {
    return fetchJson(path).catch(function () { return null })
}

function buildModel (links, providers, apps) {
    if (!links || !Array.isArray(links.taxonomy)) throw new Error('links.json')

    const parents = []
    const groups = []
    const sites = []

    links.taxonomy.forEach(function (parent) {
        const parentNode = { id: parent.id, name: parent.name, groups: [] }
        ;(parent.groups || []).forEach(function (group) {
            const groupNode = {
                id: group.id,
                name: group.name,
                parentId: parentNode.id,
                parentName: parentNode.name,
                sites: []
            }
            ;(group.links || []).forEach(function (link) {
                const site = {
                    name: link.name,
                    url: link.url,
                    desc: link.desc,
                    parentId: parentNode.id,
                    parentName: parentNode.name,
                    groupId: groupNode.id,
                    groupName: groupNode.name
                }
                groupNode.sites.push(site)
                sites.push(site)
            })
            parentNode.groups.push(groupNode)
            groups.push(groupNode)
        })
        parents.push(parentNode)
    })

    if (!parents.length) return

    state.parents = parents
    state.groups = groups
    state.sites = sites
    state.parentById = new Map(parents.map(function (parent) { return [parent.id, parent] }))
    state.groupById = new Map(groups.map(function (group) { return [group.id, group] }))

    const providerList = []
    ;((providers && providers.providers) || []).forEach(function (category) {
        ;(category.items || []).forEach(function (item) {
            providerList.push({
                name: item.name,
                url: item.url,
                query: item.query,
                prefix: item.prefix,
                category: category.category || ''
            })
        })
    })
    state.providers = providerList
    state.providerByPrefix = new Map(providerList.map(function (provider) {
        return [String(provider.prefix).toLowerCase(), provider]
    }))

    state.apps = apps && Array.isArray(apps.apps) ? apps.apps : []
}

function init () {
    cacheElements()
    fillTexts()
    readStatusCache()
    setupTheme(elements.themeButtons, elements.themeMeta)
    fillToday()
    setupHeadOffset()

    const groups = createGroups(state, elements)
    groups.setupRails()

    Promise.all([
        fetchJson('./data/links.json'),
        optionalJson('./data/providers.json'),
        optionalJson('./data/apps.json')
    ]).then(function (data) {
        const providers = data[1]
        const apps = data[2]
        buildModel(data[0], providers, apps)

        const degraded = []
        if (apps) groups.renderApps()
        else {
            elements.appsSection.hidden = true
            degraded.push(texts.appsUnavailable)
        }
        if (!providers) degraded.push(texts.providersUnavailable)

        setupSearch(state, elements, groups.selectGroup)

        if (!state.groups.length) {
            elements.panel.setAttribute('aria-busy', 'false')
            elements.panel.innerHTML = '<p class="load-error">' + escapeHtml(texts.errorLinksEmpty) + '</p>'
            announce(texts.errorLinksEmpty)
            return
        }

        const requested = new URLSearchParams(window.location.search).get('group')
        const initial = requested && state.groupById.has(requested) ? requested : state.groups[0].id
        groups.selectGroup(initial, { scroll: false, sync: false, announce: false })
        const url = new URL(window.location.href)
        url.searchParams.set('group', initial)
        window.history.replaceState(null, '', url.href)
        if (degraded.length) announce(degraded.join('·'))
    }).catch(function () {
        elements.panel.setAttribute('aria-busy', 'false')
        elements.panel.innerHTML = '<p class="load-error">' + escapeHtml(texts.loadError) + '</p>'
        announce(texts.loadError)
    })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
else init()
