(function () {
    'use strict'

    var App = window.App = window.App || {}
    var C = App.controls = {}

    /* 控件键与词典键不同名：语言控件的词典键是 control.language。 */
    var LABEL_KEYS = {
        lang: 'control.language',
        layout: 'control.layout',
        theme: 'control.theme'
    }

    var rootEl = null
    var defs = []
    var closeCurrent = null
    var outsideCloser = null

    /* 首载失败时 currentId() 为 null，统一转成空串交给 labelOf 回退。 */
    function currentValue(kind) {
        var value = kind === 'lang' ? App.i18n.get() : App.layouts.currentId()
        return value == null ? '' : value
    }

    function unselectedLabel(kind) {
        var key = kind === 'lang' ? 'control.language.unselected' : 'layout.unselected'

        return App.i18n.t(key) || ''
    }

    function optionList(kind) {
        if (kind === 'lang') {
            return App.i18n.languages.map(function (lang) {
                return { value: lang, label: App.i18n.label(lang) }
            })
        }

        return App.config.layouts.map(function (id) {
            return { value: id, label: App.i18n.t('common.layout.' + id) || id }
        })
    }

    function labelOf(kind, value) {
        if (!value) return unselectedLabel(kind)
        if (kind === 'lang') return App.i18n.label(value) || String(value)
        return App.i18n.t('common.layout.' + value) || String(value)
    }

    function closeMenu(def, focusTrigger) {
        /* 循环键没有菜单，def.menu 为 null，关闭时须先跳过。 */
        if (!def.menu || !def.menu.classList.contains('open')) return

        def.menu.classList.remove('open')
        def.menu.style.maxHeight = ''
        def.menu.style.overflowY = ''
        def.trigger.setAttribute('aria-expanded', 'false')
        if (closeCurrent === def) closeCurrent = null
        if (focusTrigger) def.trigger.focus()
    }

    function closeAll(except) {
        defs.forEach(function (def) {
            if (def !== except) closeMenu(def, false)
        })
    }

    function selectedOption(def) {
        var value = currentValue(def.kind)
        return def.options.filter(function (opt) { return opt.value === value })[0] || null
    }

    function focusOption(def, index) {
        var options = def.menu.querySelectorAll('.app-control-option')
        if (!options.length) return

        var i = (index + options.length) % options.length
        options[i].focus()
    }

    function openMenu(def) {
        closeAll(def)
        def.menu.classList.add('open')
        def.trigger.setAttribute('aria-expanded', 'true')
        closeCurrent = def

        var opts = [].slice.call(def.menu.querySelectorAll('.app-control-option'))
        var selected = selectedOption(def)
        var target = selected
            ? opts.filter(function (el) { return el.dataset.value === selected.value })[0]
            : opts[0]

        fitMenu(def)
        if (target) target.focus()
    }

    /* 向下开的菜单在视口下缘前收住高度，菜单内容改为滚动，页面不出现溢出。 */
    function fitMenu(def) {
        def.menu.style.maxHeight = ''
        def.menu.style.overflowY = ''

        var menuRect = def.menu.getBoundingClientRect()
        var triggerRect = def.trigger.getBoundingClientRect()

        if (menuRect.top < triggerRect.bottom - 1) return

        var space = window.innerHeight - menuRect.top - 8

        if (menuRect.bottom > window.innerHeight - 8 && space > 0) {
            def.menu.style.maxHeight = Math.floor(space) + 'px'
            def.menu.style.overflowY = 'auto'
        }
    }

    function choose(def, value) {
        if (def.kind === 'lang') App.i18n.set(value)
        if (def.kind === 'layout') App.layouts.select(value)
        if (def.kind === 'theme') App.theme.set(value)

        closeMenu(def, true)
    }

    function buildOption(def, option) {
        var li = document.createElement('li')
        li.className = 'app-control-option'
        li.setAttribute('role', 'option')
        li.setAttribute('tabindex', '-1')
        li.dataset.value = option.value
        li.textContent = option.label
        li.addEventListener('click', function () {
            choose(def, option.value)
        })
        return li
    }

    function buildControl(kind, labelKey) {
        var wrap = document.createElement('div')
        wrap.className = 'app-control'
        wrap.dataset.kind = kind

        var trigger = document.createElement('button')
        trigger.type = 'button'
        trigger.className = 'app-control-trigger'

        var icon = document.createElement('span')
        icon.className = 'app-control-icon'
        icon.setAttribute('aria-hidden', 'true')
        trigger.appendChild(icon)

        var label = document.createElement('span')
        label.className = 'app-control-label'
        trigger.appendChild(label)

        var def = {
            kind: kind,
            labelKey: labelKey,
            trigger: trigger,
            icon: icon,
            label: label,
            menu: null,
            options: []
        }

        if (kind === 'theme') {
            /* 三态图标全部留在 DOM 中，切换只改当前可见的一枚。 */
            App.theme.modes().forEach(function (mode) {
                icon.appendChild(createThemeIcon(mode))
            })

            trigger.classList.add('app-control-theme-icon')
            trigger.addEventListener('click', function () {
                App.theme.cycle()
            })

            wrap.appendChild(trigger)
            return { wrap: wrap, def: def }
        }

        trigger.setAttribute('aria-haspopup', 'listbox')
        trigger.setAttribute('aria-expanded', 'false')

        var menu = document.createElement('ul')
        menu.className = 'app-control-menu'
        menu.setAttribute('role', 'listbox')

        def.menu = menu

        trigger.addEventListener('click', function (e) {
            e.stopPropagation()
            if (menu.classList.contains('open')) closeMenu(def)
            else openMenu(def)
        })

        trigger.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                openMenu(def)
            } else if (e.key === 'Escape') {
                closeMenu(def)
            }
        })

        menu.addEventListener('keydown', function (e) {
            var options = [].slice.call(menu.querySelectorAll('.app-control-option'))
            var i = options.indexOf(document.activeElement)

            if (e.key === 'Escape') {
                e.preventDefault()
                closeMenu(def, true)
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                focusOption(def, i + 1)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                focusOption(def, i - 1)
            } else if (e.key === 'Home') {
                e.preventDefault()
                focusOption(def, 0)
            } else if (e.key === 'End') {
                e.preventDefault()
                focusOption(def, options.length - 1)
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (i !== -1) choose(def, options[i].dataset.value)
            } else if (e.key === 'Tab') {
                closeMenu(def)
            }
        })

        wrap.appendChild(trigger)
        wrap.appendChild(menu)
        return { wrap: wrap, def: def }
    }

    function rebuildOptions(def) {
        if (!def.menu) return

        def.menu.innerHTML = ''
        def.options = optionList(def.kind)

        def.options.forEach(function (option) {
            def.menu.appendChild(buildOption(def, option))
        })

        def.menu.setAttribute('aria-label', App.i18n.t(def.labelKey))
    }

    var SVG_NS = 'http://www.w3.org/2000/svg'

    /* 日相三式：亮色太阳、暗色月牙、系统地平线。 */
    var THEME_SHAPES = {
        light: [
            { tag: 'circle', cx: '10', cy: '10', r: '3.4' },
            {
                tag: 'path',
                d: 'M10 1.7v2M10 16.3v2M1.7 10h2M16.3 10h2' +
                    'M4.1 4.1l1.4 1.4M14.5 14.5l1.4 1.4' +
                    'M15.9 4.1l-1.4 1.4M5.5 14.5l-1.4 1.4'
            }
        ],
        dark: [
            { tag: 'path', d: 'M15.4 12.8A6.6 6.6 0 0 1 7.2 4.6a6.6 6.6 0 1 0 8.2 8.2Z' }
        ],
        system: [
            { tag: 'path', d: 'M2 13.2h16' },
            { tag: 'path', d: 'M6.1 13.2a3.9 3.9 0 0 1 7.8 0' },
            { tag: 'path', d: 'M10 3.2v2.6' },
            { tag: 'path', d: 'm4.4 6.1 1.4 1.4M15.6 6.1l-1.4 1.4' }
        ]
    }

    function createThemeIcon(mode) {
        var svg = document.createElementNS(SVG_NS, 'svg')
        svg.setAttribute('class', 'theme-icon theme-icon-' + mode)
        svg.setAttribute('viewBox', '0 0 20 20')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '1.5')
        svg.setAttribute('stroke-linecap', 'round')
        svg.setAttribute('stroke-linejoin', 'round')
        svg.setAttribute('aria-hidden', 'true')
        svg.setAttribute('focusable', 'false')
        svg.dataset.mode = mode

        THEME_SHAPES[mode].forEach(function (shape) {
            var node = document.createElementNS(SVG_NS, shape.tag)
            Object.keys(shape).forEach(function (key) {
                if (key !== 'tag') node.setAttribute(key, shape[key])
            })
            svg.appendChild(node)
        })

        return svg
    }

    /* 主题可访问名称同时给出当前态与点击后的目标态，避免与可见状态错位。 */
    function nextThemeMode(mode) {
        var modes = App.theme.modes()
        return modes[(modes.indexOf(mode) + 1) % modes.length]
    }

    C.create = function () {
        rootEl = document.createElement('div')
        rootEl.className = 'app-controls'

        defs = ['lang', 'layout', 'theme'].map(function (kind) {
            var built = buildControl(kind, LABEL_KEYS[kind])
            rootEl.appendChild(built.wrap)
            return built.def
        })

        outsideCloser = function (e) {
            if (!rootEl.contains(e.target)) closeAll(null)
        }
        document.addEventListener('click', outsideCloser)

        C.refresh()
        return C
    }

    C.refresh = function () {
        defs.forEach(function (def) {
            rebuildOptions(def)

            if (def.kind === 'theme') {
                /* 图标按三态模式判断，不按当前亮暗实值，否则跟随系统与亮色同图。 */
                var mode = App.theme.mode()
                var next = nextThemeMode(mode)
                var currentName = App.i18n.t('theme.' + mode)
                var nextName = App.i18n.t('theme.' + next)
                var icons = def.icon.querySelectorAll('.theme-icon')

                Array.prototype.forEach.call(icons, function (el) {
                    el.classList.toggle('is-on', el.dataset.mode === mode)
                })

                def.label.textContent = ''
                def.trigger.setAttribute('aria-label',
                    App.i18n.t('control.theme.current') + ': ' + currentName + ', ' +
                    App.i18n.t('control.theme.next') + ' ' + nextName)
                return
            }

            var current = currentValue(def.kind)
            var name = labelOf(def.kind, current)

            def.icon.textContent = ''
            def.label.textContent = name
            def.trigger.setAttribute('aria-label', App.i18n.t(def.labelKey) + ': ' + name)

            var options = def.menu.querySelectorAll('.app-control-option')

            Array.prototype.forEach.call(options, function (el) {
                var on = el.dataset.value === current
                el.setAttribute('aria-selected', on ? 'true' : 'false')
            })
        })
    }

    C.attach = function (slot) {
        if (!rootEl) return

        var target = slot || document.getElementById('layoutRoot')
        if (target && rootEl.parentNode !== target) target.appendChild(rootEl)
    }
})()
