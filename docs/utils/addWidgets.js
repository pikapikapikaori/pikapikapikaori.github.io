// default values
let addWidgetsOptions = {
    useSwitchMode: true,
    top: 0,
    right: 26,
    topOffset: 500
}

// Docsify plugin functions
function plugin(hook, vm) {
    if (!addWidgetsOptions.useSwitchMode) {
        return
    }

    let switchSpan,
        themeSpan,
        colorPickerSpan,
        colorPickerPopupSpan,
        scrollToCommentSpan,
        showSakuraSpan,
        showLive2dSpan,
        showWidgetsSpan,
        progressSpan,
        scrollToTopSpan

    let widgets = []

    let widgetsCnt = 7

    const widgetTop = 35

    const widgetSize = '24px'

    const widgetColor = 'var(--theme-color,#ea6f5a)'

    const icons = {
        lightMode: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M12 18a6 6 0 100-12 6 6 0 000 12zM22 12h1M12 2V1M12 23v-1M20 20l-1-1M20 4l-1 1M4 20l1-1M4 4l1 1M1 12h1" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
        darkMode: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M3 11.507a9.493 9.493 0 0018 4.219c-8.507 0-12.726-4.22-12.726-12.726A9.494 9.494 0 003 11.507z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
        autoMode: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M3 15c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.482 0 4.965-3 4.965-3s2.483 3 4.345 3M3 20c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.482 0 4.965-3 4.965-3s2.483 3 4.345 3M19 10a7 7 0 10-14 0" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
        themeSwitcher: `<svg xmlns="http://www.w3.org/2000/svg" width="${widgetSize}" height="${widgetSize}" viewBox="0 0 48 48"><title>theme</title><path fill="none" stroke="${widgetColor}" stroke-linejoin="round" stroke-width="3" d="M18 6a6 6 0 0 0 12 0h5.455L42 15.818l-5.727 4.91V42H11.727V20.727L6 15.818L12.546 6z"/></svg>`,
        colorPicker: `<svg xmlns="http://www.w3.org/2000/svg" width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24"><title>color-24-regular</title><path fill="${widgetColor}" d="M3.839 5.858c2.94-3.916 9.03-5.055 13.364-2.36c4.28 2.66 5.854 7.777 4.1 12.577c-1.655 4.533-6.016 6.328-9.159 4.048c-1.177-.854-1.634-1.925-1.854-3.664l-.106-.987l-.045-.398c-.123-.934-.311-1.352-.705-1.572c-.535-.298-.892-.305-1.595-.033l-.351.146l-.179.078c-1.014.44-1.688.595-2.541.416l-.2-.047l-.164-.047c-2.789-.864-3.202-4.647-.565-8.157m.984 6.716l.123.037l.134.03c.439.087.814.015 1.437-.242l.602-.257c1.202-.493 1.985-.54 3.046.05c.917.512 1.275 1.298 1.457 2.66l.053.459l.055.532l.047.422c.172 1.361.485 2.09 1.248 2.644c2.275 1.65 5.534.309 6.87-3.349c1.516-4.152.174-8.514-3.484-10.789c-3.675-2.284-8.899-1.306-11.373 1.987c-2.075 2.763-1.82 5.28-.215 5.816m11.225-1.994a1.25 1.25 0 1 1 2.414-.647a1.25 1.25 0 0 1-2.414.647m.494 3.488a1.25 1.25 0 1 1 2.415-.647a1.25 1.25 0 0 1-2.415.647M14.07 7.577a1.25 1.25 0 1 1 2.415-.647a1.25 1.25 0 0 1-2.415.647m-.028 8.998a1.25 1.25 0 1 1 2.414-.647a1.25 1.25 0 0 1-2.414.647m-3.497-9.97a1.25 1.25 0 1 1 2.415-.646a1.25 1.25 0 0 1-2.415.646"/></svg>`,
        commentScroller: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M17 12.5a.5.5 0 100-1 .5.5 0 000 1zM12 12.5a.5.5 0 100-1 .5.5 0 000 1zM7 12.5a.5.5 0 100-1 .5.5 0 000 1z" fill="${widgetColor}" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
        showSakura: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM13 9s1-2 1-4-2-4-2-4-2 2-2 4 1 4 1 4" stroke="${widgetColor}" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9 11s-2-1-4-1-4 2-4 2 2 2 4 2 4-1 4-1M13 15s1 2 1 4-2 4-2 4-2-2-2-4 1-4 1-4M15 11s2-1 4-1 4 2 4 2-2 2-4 2-4-1-4-1M10.586 9.172S9.879 7.05 8.464 5.636C7.05 4.222 4.222 4.222 4.222 4.222s0 2.828 1.414 4.243c1.414 1.414 3.536 2.121 3.536 2.121M9.172 13.414s-2.122.707-3.536 2.122c-1.414 1.414-1.414 4.242-1.414 4.242s2.828 0 4.242-1.414c1.415-1.414 2.122-3.536 2.122-3.536M14.829 13.414s2.12.707 3.535 2.122c1.414 1.414 1.414 4.242 1.414 4.242s-2.828 0-4.242-1.414c-1.415-1.414-2.122-3.536-2.122-3.536M13.414 9.172s.707-2.122 2.122-3.536c1.414-1.414 4.242-1.414 4.242-1.414s0 2.828-1.414 4.243c-1.414 1.414-3.536 2.121-3.536 2.121" stroke="${widgetColor}" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
        live2d: `<svg xmlns="http://www.w3.org/2000/svg" width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24"><title>messages-people-woman-heart</title><path fill="${widgetColor}" d="M13.595 19.123a2.06 2.06 0 0 1-.849-.83a3.8 3.8 0 0 1-.6-1.148c-.36-1.41.16-3.347-.519-5.106A5.23 5.23 0 0 0 9.13 9.332a4 4 0 0 0-3.137-.34a4.73 4.73 0 0 0-2.508 1.848c-.3.452-.545.939-.729 1.449a7.4 7.4 0 0 0-.41 1.559c-.14 1.129.08 2.308-.11 3.347a2.37 2.37 0 0 1-.999 1.598a2.6 2.6 0 0 1-.39.24a2 2 0 0 1-.409.13a.33.33 0 0 0-.25.19a.34.34 0 0 0 0 .31q.282.416.66.749c.189.174.42.298.67.36a.29.29 0 0 0 .339-.24a.3.3 0 0 0-.24-.35a1.15 1.15 0 0 1-.45-.33l-.17-.16h.08q.27-.114.52-.27a3.1 3.1 0 0 0 1.439-1.998a8.3 8.3 0 0 0 .16-1.528c.079.61.28 1.197.59 1.728c.39.677.938 1.25 1.598 1.669a7.34 7.34 0 0 0-3.337 2.128a5.3 5.3 0 0 0-.6.849a9 9 0 0 0-.63 1.349a.31.31 0 0 0 .18.36a.3.3 0 0 0 .39-.17q.244-.52.56-1c.196-.31.431-.596.7-.849a6.9 6.9 0 0 1 3.166-1.648a5.83 5.83 0 0 1 3.477.14a4.3 4.3 0 0 1 1.818 1.289c.52.596.94 1.27 1.25 1.998a.34.34 0 1 0 .629-.24a7.8 7.8 0 0 0-1.21-2.318a5.4 5.4 0 0 0-2.097-1.728c-.16-.06-.32-.1-.49-.15q.429-.232.79-.56a5.7 5.7 0 0 0 1.169-1.688c0-.06.05-.13.08-.19q.03.26.11.51c.227.603.566 1.16.998 1.638q.302.373.7.64q-.045.078-.1.15a.65.65 0 0 1-.32.269a.34.34 0 0 0 .23.64c.211-.071.4-.195.55-.36a2.5 2.5 0 0 0 .46-.72a.34.34 0 0 0 0-.31a.31.31 0 0 0-.26-.2m-3.207-2.468a4.8 4.8 0 0 1-1.079 1.329a3.3 3.3 0 0 1-.86.48a3.5 3.5 0 0 1-.998.2a2.6 2.6 0 0 1-.73-.07a3.9 3.9 0 0 1-2.228-1.499a3.8 3.8 0 0 1-.709-1.669c.65.05 1.299.1 1.998.12h1.29c.429 0 .858 0 1.288-.08c.86-.07 1.709-.17 2.558-.27a3.7 3.7 0 0 1-.53 1.46m-1.13-2.258a3 3 0 0 0 0-.53q-.075-.505-.21-.998a.3.3 0 1 0-.6.04a9 9 0 0 0-.05.998q.016.228.06.45H6.992q-.649 0-1.289.06c-.829.06-1.648.16-2.477.25c0-.24 0-.48.08-.71c.09-.449.227-.888.41-1.308c.181-.41.41-.8.679-1.16a3.7 3.7 0 0 1 1.918-1.398a3 3 0 0 1 2.278.24a4.24 4.24 0 0 1 2.078 2.098a5.9 5.9 0 0 1 .42 1.998z"/><path fill="${widgetColor}" d="M23.816 5.295c0-.859 0-2.947-.05-3.846a1.3 1.3 0 0 0-.3-.8A5.6 5.6 0 0 0 21.468.2C20.26.08 18.611 0 17.442 0c-.46 0-4.366 0-6.654.18c-.643 0-1.279.133-1.868.39a.65.65 0 0 0-.19.32q-.141.647-.15 1.308c-.1 1.798-.06 4.796-.06 5.455a.35.35 0 0 0 .69 0c0-.54 0-2.418.1-4.056c0-.86.09-1.639.159-2.128c0-.11 0-.23.06-.29s.24 0 .36 0q1.294-.159 2.597-.18h4.946c.999 0 2.268.11 3.377.22c.72.07 1.349.15 1.748.23h.06c.08.869.05 2.897 0 3.726c0 .5.08 2.278.08 3.817q.025 1.001-.08 1.998q.009.135 0 .27a5 5 0 0 0-.69 0H20.83c-1-.06-2.188-.15-2.708-.12a.85.85 0 0 0-.6.22c-.249.28-.489.949-.928 1.678q-.302.492-.69.92a2.2 2.2 0 0 1-1.638.719c-.08-.56 0-2.088 0-2.758a1.7 1.7 0 0 0-.07-.42a.36.36 0 0 0-.25-.19a.3.3 0 0 0-.35.25s0 3.398.07 3.537a.44.44 0 0 0 .32.26c.33.066.67.066 1 0a3.06 3.06 0 0 0 1.438-.819q.461-.457.819-1c.38-.589.61-1.138.83-1.438h.05c.499 0 1.598.12 2.597.21q.84.06 1.678 0a1.68 1.68 0 0 0 1-.34a3.24 3.24 0 0 0 .39-1.578c.129-1.649.02-4.396.03-5.096"/><path fill="${widgetColor}" d="M14.325 8.992c.19.17.51.55.819.79c.202.178.452.292.72.329c.356.013.708-.092.998-.3c.464-.354.887-.76 1.26-1.209a11.4 11.4 0 0 0 1.648-1.998a4.1 4.1 0 0 0 .59-1.778a2.11 2.11 0 0 0-.75-1.829a1.94 1.94 0 0 0-1.998-.29a2.5 2.5 0 0 0-.8.49a7 7 0 0 0-.659.69a3.3 3.3 0 0 0-.36-.55a2.3 2.3 0 0 0-.62-.55a1.68 1.68 0 0 0-1.568 0a2.9 2.9 0 0 0-1.468 1.649a3 3 0 0 0 .19 2.248a8.9 8.9 0 0 0 1.998 2.308m-1.28-4.396c.12-.424.377-.796.73-1.06a1 1 0 0 1 1.1-.179q.26.141.459.36q.32.374.55.809a.3.3 0 0 0 .409.13a.33.33 0 0 0 .17-.1q.39-.44.839-.82c.174-.146.374-.257.59-.33a1.13 1.13 0 0 1 1.129.22a1.21 1.21 0 0 1 .38 1.08a3.3 3.3 0 0 1-.53 1.349c-.461.647-.99 1.243-1.579 1.778c-.19.2-.47.52-.78.8c-.309.279-.349.359-.529.359l-.869-.82a8 8 0 0 1-1.798-1.998a2.1 2.1 0 0 1-.27-1.548z"/></svg>`,
        showWidgets: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 12h7M15 12h7" stroke="${widgetColor}" stroke-width="1.5"></path></svg>`,
        topScroller: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M6 11l6-6 6 6M6 19l6-6 6 6" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
    }

    let isNowMobile = false

    // 黑暗模式切换、主题切换
    let themeState = {
        modeIndex: 0,
        modes: ['auto', 'light', 'dark'],

        themeIndex: 0,
        groups: [
            {
                name: 'default',
                light: null,
                dark: null
            },
            {
                name: 'lavender',
                light: './style/theme/lavender.css',
                dark: './style/theme/lavandula.css'
            },
            {
                name: 'kraft',
                light: './style/theme/kraft.css',
                dark: './style/theme/bronze.css'
            },
            {
                name: 'matcha',
                light: './style/theme/matcha.css',
                dark: './style/theme/library.css'
            },
            {
                name: 'kirby',
                light: './style/theme/kirby.css',
                dark: './style/theme/metaknight.css'
            },
            {
                name: 'catppuccin',
                light: './style/theme/latte.css',
                dark: './style/theme/catppuccin.css'
            },
            {
                name: 'gold',
                light: './style/theme/whitegold.css',
                dark: './style/theme/darkgold.css'
            },
            {
                name: 'calligraphy',
                light: './style/theme/calligraphy.css',
                dark: './style/theme/grid.css'
            },
            {
                name: 'typography',
                light: './style/theme/typography.css',
                dark: './style/theme/dot.css'
            }
        ]
    }

    // 页面主题色
    let iscolorPickerPopupOpen = false

    // 进度条
    const doc = document.documentElement
    let ticking = false

    let initializeWidgetSpan = function (el) {
        el.className = 'page-right-tools-widgets-span'
        el.style.position = 'fixed'
        el.style.right = addWidgetsOptions.right.toString() + 'px'
        el.style.top = `calc(${addWidgetsOptions.top}px + (100vh - ${35 * widgetsCnt}px) / 2 + ${35 * widgets.indexOf(el)}px)`
    }

    let createWidget = function (spanId) {
        let elSpan = document.createElement('span')
        elSpan.id = spanId
        widgets.push(elSpan)
        initializeWidgetSpan(elSpan)

        return elSpan
    }

    const toggleAppear = (el, appearCls, disappearCls, show) => {
        el.classList.toggle(appearCls, show)
        el.classList.toggle(disappearCls, !show)
    }

    function isMobile() {
        let WIN = window
        let NA = WIN.navigator
        let UA = NA.userAgent.toLowerCase()

        function test(needle) {
            return needle.test(UA)
        }
        let IsAndroid = test(/android|htc/) || /linux/i.test(NA.platform + '')
        let IsIPhone = !IsAndroid && test(/ipod|iphone/)
        let IsWinPhone = test(/windows phone/)

        let device = {
            IsAndroid: IsAndroid,
            IsIPhone: IsIPhone,
            IsWinPhone: IsWinPhone,
        }
        let documentElement = WIN.document.documentElement
        for (var i in device) {
            if (device[i]) {
                documentElement.className += ' ' + i.replace('Is', '').toLowerCase()
            }
        }
        return device.IsAndroid || device.IsIPhone || device.IsWinPhone
    }

    // 黑暗模式切换、主题切换
    let resolveIsDark = function () {
        const mode = themeState.modes[themeState.modeIndex]
        if (mode === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches
        }
        return mode === 'dark'
    }

    let applyThemeColor = function () {
        const isDark = resolveIsDark()
        const vueTheme = document.getElementById('theme-vue')
        const darkTheme = document.getElementById('theme-dark')
        const colorTheme = document.getElementById('theme-color')

        const group = themeState.groups[themeState.themeIndex]
        const file = isDark ? group.dark : group.light

        if (!file) {
            vueTheme.disabled = isDark
            darkTheme.disabled = !isDark

            colorTheme.href = ''
            colorTheme.disabled = true
        }
        else {
            vueTheme.disabled = true
            darkTheme.disabled = true

            colorTheme.disabled = false
            colorTheme.href = file
        }
    }

    // 页面主题色
    function hslToHex(h, s, l) {
        l /= 100
        const a = s * Math.min(l, 1 - l) / 100
        const f = n => {
            const k = (n + h / 30) % 12
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
            return Math.round(255 * color).toString(16).padStart(2, '0')   // convert to Hex and prefix "0" if needed
        }
        return `#${f(0)}${f(8)}${f(4)}`
    }

    // 进度条
    function render() {
        ticking = false
        const max = doc.scrollHeight - window.innerHeight
        const p = max > 0
            ? Math.min(100, Math.max(0, (window.scrollY / max) * 100))
            : 0
        const text = Math.round(p)
        progressSpan.style.setProperty('--p', p)
        const n = progressSpan.querySelector('.num')
        if (n) n.textContent = text
    }

    // 回顶部
    let calScrollDisplay = function () {
        let offset = window.document.documentElement.scrollTop
        return offset >= addWidgetsOptions.topOffset ? 'block' : 'none'
    }

    // 黑暗模式切换
    let initSwitchMode = function () {
        switchSpan = createWidget('switchModeSpan')

        let updateIcon = function () {
            const iconMap = {
                light: icons.lightMode,
                dark: icons.darkMode,
                auto: icons.autoMode
            }
            switchSpan.innerHTML = iconMap[themeState.modes[themeState.modeIndex]]
        }

        let renderTheme = function () {
            applyThemeColor()
            updateIcon()
        }

        renderTheme()

        let onPreferredModeChange = function () {
            if (themeState.modeIndex === 0) {
                renderTheme()
            }
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onPreferredModeChange)

        switchSpan.onclick = function () {

            themeState.modeIndex = (themeState.modeIndex + 1) % themeState.modes.length
            renderTheme()
        }

        document.body.appendChild(switchSpan)
    }

    // 主题切换
    let initSwitchTheme = function () {
        themeSpan = createWidget('switchThemeSpan')
        themeSpan.innerHTML = icons.themeSwitcher

        applyThemeColor()

        themeSpan.onclick = function () {
            themeState.themeIndex = (themeState.themeIndex + 1) % themeState.groups.length
            applyThemeColor()
        }

        document.body.appendChild(themeSpan)
    }

    // 页面主题色
    let initColorPicker = function () {
        colorPickerSpan = createWidget('colorPickerSpan')
        colorPickerSpan.innerHTML = icons.colorPicker

        colorPickerPopupSpan = document.createElement('span')
        colorPickerPopupSpan.id = 'colorPickerPopupSpan'
        colorPickerPopupSpan.className = 'color-picker-popup-span color-picker-popup-span-disappear'
        colorPickerPopupSpan.style.position = 'fixed'
        colorPickerPopupSpan.style.right = (addWidgetsOptions.right + 35).toString() + 'px'
        colorPickerPopupSpan.style.top = `calc(${addWidgetsOptions.top}px + (100vh - ${widgetTop * widgetsCnt}px) / 2 + ${widgetTop * widgets.indexOf(colorPickerSpan)}px)`
        let colorPickerPopupDiv = document.createElement('div')
        colorPickerPopupDiv.id = 'color-picker-popup-div'
        colorPickerPopupDiv.className = 'color-picker-popup-div'
        colorPickerPopupDiv.innerHTML = '<div class="color-picker-preset-color-list-div"><div class="color-picker-preset-color-btn-div" style="background-color: #eca2a2;" data-hue="0"></div><div class="color-picker-preset-color-btn-div" style="background-color: #ecc7a2;" data-hue="30"></div><div class="color-picker-preset-color-btn-div" style="background-color: #ececa2;" data-hue="60"></div><div class="color-picker-preset-color-btn-div" style="background-color: #c7eca2;" data-hue="90"></div><div class="color-picker-preset-color-btn-div" style="background-color: #a2ecec;" data-hue="180"></div><div class="color-picker-preset-color-btn-div" style="background-color: #aea2ec;" data-hue="250"></div><div class="color-picker-preset-color-btn-div" style="background-color: #c7a2ec;" data-hue="270"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2ec;" data-hue="300"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2c7;" data-hue="330"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2b4;" data-hue="345"></div></div><input type="range" min="0" max="360" value="270" class="color-picker-slider" id="color-picker-slider" step="5">'

        colorPickerPopupSpan.appendChild(colorPickerPopupDiv)
        document.body.appendChild(colorPickerSpan)
        document.body.appendChild(colorPickerPopupSpan)

        let colorPickerSlider = colorPickerPopupDiv.getElementsByClassName('color-picker-slider')[0]

        colorPickerSlider.oninput = function () {
            document.documentElement.style.setProperty('--theme-color', hslToHex(this.value, 66, 78))
        }

        Array.from(colorPickerPopupDiv.getElementsByClassName('color-picker-preset-color-btn-div')).forEach(colorPickerPresetColorBtn => {
            colorPickerPresetColorBtn.onclick = function (event) {
                document.documentElement.style.setProperty('--theme-color', hslToHex(event.target.dataset.hue, 66, 78))
                colorPickerSlider.value = event.target.dataset.hue
            }
        })

        colorPickerSpan.onclick = function () {
            iscolorPickerPopupOpen = !iscolorPickerPopupOpen

            toggleAppear(colorPickerPopupSpan, 'color-picker-popup-span-appear', 'color-picker-popup-span-disappear', iscolorPickerPopupOpen)
        }
    }

    // 滚动到评论区
    let initCommentScroll = function () {
        scrollToCommentSpan = createWidget('scrollToCommentSpan')
        scrollToCommentSpan.innerHTML = icons.commentScroller

        scrollToCommentSpan.onclick = function () {
            document.getElementById('gitalk-container').scrollIntoView({ behavior: 'smooth', })
        }

        document.body.appendChild(scrollToCommentSpan)
    }

    // 樱花雨特效
    let initSakuraRain = function () {
        let sakura = new Sakura('body')

        showSakuraSpan = createWidget('showSakuraSpan')
        showSakuraSpan.innerHTML = icons.showSakura

        let isSakuraDisplayed = true

        showSakuraSpan.onclick = function () {
            if (isSakuraDisplayed) {
                sakura.stop(true)
            }
            else {
                sakura.start()
            }

            isSakuraDisplayed = !isSakuraDisplayed
        }

        document.body.appendChild(showSakuraSpan)
    }

    // Live2d 小人
    let initLive2d = function () {
        showLive2dSpan = createWidget('showLive2dSpan')
        showLive2dSpan.innerHTML = icons.live2d

        showLive2dSpan.onclick = function () {
            let live2dCanvas = document.getElementById('canvas')
            live2dCanvas.classList.toggle('canvas-hide')
        }

        document.body.appendChild(showLive2dSpan)
    }

    // 隐藏显示小组件
    let initShowWidgets = function () {
        showWidgetsSpan = createWidget('showWidgetsSpan')
        showWidgetsSpan.innerHTML = icons.showWidgets

        let isWidgetsOpen = true

        showWidgetsSpan.onclick = function () {
            let widgetsSpanList = [
                switchSpan,
                colorPickerSpan,
                scrollToCommentSpan,
                showSakuraSpan
            ]

            if (!isNowMobile) {
                widgetsSpanList.push(showLive2dSpan)
            }

            isWidgetsOpen = !isWidgetsOpen

            widgetsSpanList.forEach(widget => toggleAppear(
                widget,
                'page-right-tools-widgets-span-appear',
                'page-right-tools-widgets-span-disappear',
                isWidgetsOpen
            ))

            if (!isWidgetsOpen) {
                iscolorPickerPopupOpen = isWidgetsOpen
                toggleAppear(
                    colorPickerPopupSpan,
                    'color-picker-popup-span-appear',
                    'color-picker-popup-span-disappear',
                    iscolorPickerPopupOpen
                )
            }
        }

        document.body.appendChild(showWidgetsSpan)
    }

    // 进度条
    let initProgress = function () {
        progressSpan = createWidget('progressSpan')
        progressSpan.classList.add('read-progress')
        progressSpan.style.height = widgetSize
        progressSpan.style.width = widgetSize
        progressSpan.innerHTML = `<span class="num progress-num-hide" style="color: ${widgetColor};">0</span>`

        const n = progressSpan.querySelector('.num')
        if (n) {
            progressSpan.onclick = function () {
                n.classList.toggle('progress-num-hide')
            }
        }

        document.body.appendChild(progressSpan)

        function schedule() {
            if (ticking) return
            ticking = true
            requestAnimationFrame(render)
        }

        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body)

        render()
    }

    // 回顶部
    let initScrollToTop = function () {
        scrollToTopSpan = createWidget('scrollToTopSpan')
        scrollToTopSpan.innerHTML = icons.topScroller

        scrollToTopSpan.style.display = calScrollDisplay()

        scrollToTopSpan.onclick = function (e) {
            e.stopPropagation()
            let step = window.scrollY / 15
            let scroll = function () {
                window.scrollTo(0, window.scrollY - step)
                if (window.scrollY > 0) {
                    setTimeout(scroll, 15)
                }
            }
            scroll()
        }

        document.body.appendChild(scrollToTopSpan)

        let onScroll = function () {
            scrollToTopSpan.style.display = calScrollDisplay()
        }
        window.addEventListener('scroll', onScroll)
    }

    hook.mounted(function () {

        isNowMobile = isMobile()

        if (!isNowMobile) {
            widgetsCnt = 8
        }

        initSwitchMode()
        initSwitchTheme()
        initColorPicker()
        initCommentScroll()
        initSakuraRain()
        if (!isNowMobile) {
            initLive2d()
        }
        initShowWidgets()
        initProgress()
        initScrollToTop()

    })
}

// Docsify plugin options
window.$docsify['addWidgets'] = Object.assign(
    addWidgetsOptions,
    window.$docsify['addWidgets']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
