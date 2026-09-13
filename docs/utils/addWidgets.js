// default values
let addWidgetsOptions = {
    useSwitchMode: true,
    top: 0,
    right: 26,
    topOffset: 500,
    themes: [
        {
            name: 'default',
            light: null,
            dark: null,
            lightColor: '#ffffff',
            darkColor: '#3f3f3f'
        },
        {
            name: 'lavender',
            light: './style/theme/lavender.css',
            dark: './style/theme/lavandula.css',
            lightColor: '#f5f0fa',
            darkColor: '#1f1830'
        },
        {
            name: 'kraft',
            light: './style/theme/kraft.css',
            dark: './style/theme/bronze.css',
            lightColor: '#f4ecd8',
            darkColor: '#2a1f14'
        },
        {
            name: 'matcha',
            light: './style/theme/matcha.css',
            dark: './style/theme/library.css',
            lightColor: '#e3efd1',
            darkColor: '#1e3328'
        },
        {
            name: 'kirby',
            light: './style/theme/kirby.css',
            dark: './style/theme/metaknight.css',
            lightColor: '#ffeef4',
            darkColor: '#1a2238'
        },
        {
            name: 'calligraphy',
            light: './style/theme/calligraphy.css',
            dark: './style/theme/grid.css',
            lightColor: '#fbfbf5',
            darkColor: '#1a2028'
        },
        {
            name: 'typography',
            light: './style/theme/typography.css',
            dark: './style/theme/dot.css',
            lightColor: '#fafaf5',
            darkColor: '#1e2128'
        }
    ]
}

// Docsify plugin functions
function plugin(hook, vm) {
    if (!addWidgetsOptions.useSwitchMode) {
        return
    }

    let switchSpan,
        themeSpan,
        themePickerPopupSpan,
        colorPickerSpan,
        colorPickerPopupSpan,
        scrollToCommentSpan,
        showSakuraSpan,
        showLive2dSpan,
        showWidgetsSpan,
        progressSpan,
        scrollToTopSpan

    let widgets = []

    let widgetsCnt = 8

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
        live2d: `<svg xmlns="http://www.w3.org/2000/svg" width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24"><title>face-woman-shimmer-outline</title><path fill="${widgetColor}" d="m19.5 1l-1.09 2.41L16 4.5l2.41 1.09L19.5 8l1.1-2.41L23 4.5l-2.4-1.09M12 2C6.5 2 2 6.5 2 12v10h20V12c0-1.47-.33-2.87-.9-4.13l-1.24 2.7c.09.47.14.93.14 1.43c0 4.43-3.57 8-8 8s-8-3.57-8-8v-.14a9.93 9.93 0 0 0 5.74-5.55a10 10 0 0 0 9.09 3.6L17.96 8h-.46c-2.82 0-5.4-1.5-6.84-3.88c.44-.07.88-.12 1.34-.12c.5 0 .96.05 1.42.13l2.71-1.22A9.9 9.9 0 0 0 12 2M8.09 5a8.12 8.12 0 0 1-3.68 4.5C5.04 7.57 6.37 6 8.09 5M9 11.75a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5m6 0a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5M4 17.97c.58.77 1.26 1.45 2.03 2.03H4m16-2.03V20h-2.03c.77-.58 1.45-1.26 2.03-2.03"/></svg>`,
        showWidgets: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 12h7M15 12h7" stroke="${widgetColor}" stroke-width="1.5"></path></svg>`,
        topScroller: `<?xml version="1.0" encoding="UTF-8"?><svg width="${widgetSize}" height="${widgetSize}" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" color="${widgetColor}"><path d="M6 11l6-6 6 6M6 19l6-6 6 6" stroke="${widgetColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
    }

    let isNowMobile = false

    // 黑暗模式切换、主题切换
    let themeState = {
        modeIndex: 0,
        modes: ['auto', 'light', 'dark'],

        themeIndex: 0,
        groups: addWidgetsOptions.themes
    }

    // 主题切换
    let isthemePickerOpen = false

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

        themePickerPopupSpan = document.createElement('span')
        themePickerPopupSpan.id = 'themePickerPopupSpan'
        themePickerPopupSpan.className = 'theme-picker-popup-span theme-picker-popup-span-disappear'
        themePickerPopupSpan.style.position = 'fixed'
        themePickerPopupSpan.style.right = (addWidgetsOptions.right + 35).toString() + 'px'

        let themePickerPopupDiv = document.createElement('div')
        themePickerPopupDiv.id = 'theme-picker-popup-div'
        themePickerPopupDiv.className = 'theme-picker-popup-div'

        let presetListDiv = document.createElement('div')
        presetListDiv.className = 'theme-picker-preset-color-list-div'

        themeState.groups.forEach(function (group, index) {
            let btnDiv = document.createElement('div')
            btnDiv.className = 'theme-picker-preset-color-btn-div'
            btnDiv.dataset.themeIndex = index
            btnDiv.innerHTML =
                '<div class="theme-picker-color-half" style="background-color: ' + group.lightColor + ';"></div>' +
                '<div class="theme-picker-color-half" style="background-color: ' + group.darkColor + ';"></div>'

            btnDiv.onclick = function () {
                themeState.themeIndex = index
                applyThemeColor()
            }

            presetListDiv.appendChild(btnDiv)
        })

        themePickerPopupDiv.appendChild(presetListDiv)
        themePickerPopupSpan.appendChild(themePickerPopupDiv)
        document.body.appendChild(themePickerPopupSpan)
        themePickerPopupSpan.style.top = `calc(${addWidgetsOptions.top}px + (100vh - ${widgetTop * widgetsCnt}px) / 2 + ${widgetTop * (widgets.indexOf(themeSpan) + 1)}px - ${themePickerPopupSpan.offsetHeight}px - ${widgetTop}px + ${widgetSize})`

        themeSpan.onclick = function (e) {
            isthemePickerOpen = !isthemePickerOpen

            themePickerPopupSpan.classList.toggle('theme-picker-popup-span-disappear')
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

            colorPickerPopupSpan.classList.toggle('color-picker-popup-span-disappear')
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
                themeSpan,
                colorPickerSpan,
                scrollToCommentSpan,
                showSakuraSpan
            ]

            if (!isNowMobile) {
                widgetsSpanList.push(showLive2dSpan)
            }

            isWidgetsOpen = !isWidgetsOpen

            widgetsSpanList.forEach(widget => widget.classList.toggle('page-right-tools-widgets-span-disappear'))

            if (!isWidgetsOpen) {
                iscolorPickerPopupOpen = isWidgetsOpen
                colorPickerPopupSpan.classList.add('color-picker-popup-span-disappear')

                isthemePickerOpen = isWidgetsOpen
                themePickerPopupSpan.classList.add('theme-picker-popup-span-disappear')
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
            widgetsCnt = 9
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
