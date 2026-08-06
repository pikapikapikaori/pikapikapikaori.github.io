// default values
var switchLightDarkModeOptions = {
    useSwitchMode: true,
    switchDynamicPicture: false,
    top: 130,
    right: 26,
}

// Docsify plugin functions
function plugin(hook, vm) {
    if (!switchLightDarkModeOptions.useSwitchMode) {
        return
    }

    let themeModes = ['light', 'dark', 'auto',]

    let currentThemeModeIndex = 2

    let changeDynamicImageThemeMode = function (currentTheme) {
        let dynamicImageThemeName = 'buefy'
        switch (currentTheme) {
        case 'light':
            dynamicImageThemeName = 'buefy'
            break
        case 'dark':
            dynamicImageThemeName = 'material-palenight'
            break
        case 'auto':
            dynamicImageThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'material-palenight' : 'buefy'
            break
        }

        Array.from(document.getElementsByClassName('dynamic-picture-according-to-theme-mode')).forEach(img => {
            var imgSrc = img.src

            if (imgSrc.indexOf('theme=') > -1) {
                img.src = imgSrc.split('theme=')[0] + 'theme=' + dynamicImageThemeName
            }
            else {
                img.src = imgSrc + '&theme=' + dynamicImageThemeName
            }
        })
    }

    let initializeWidgetSpan = function (el, topOffset) {
        el.className = 'page-right-tools-widgets-span'
        el.style.position = 'fixed'
        el.style.right = switchLightDarkModeOptions.right.toString() + 'px'
        el.style.top = (switchLightDarkModeOptions.top + 35 * topOffset).toString() + 'px'
    }

    hook.mounted(function () {

        // 黑暗模式切换
        let lightTheme = Docsify.dom.findAll('link[href*="vue.css"]')[0]
        let darkTheme = Docsify.dom.findAll('link[href*="dark.css"]')[0]

        let darkThemeTableCss = Docsify.dom.findAll('link[href*="darkModeThemeTable.css"]')[0]

        var switchSpan = document.createElement('span')

        switchSpan.id = 'switchLightDarkModeDivBeforeArticle'
        initializeWidgetSpan (switchSpan, 3)

        const lightModeIconHtml = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M12 18a6 6 0 100-12 6 6 0 000 12zM22 12h1M12 2V1M12 23v-1M20 20l-1-1M20 4l-1 1M4 20l1-1M4 4l1 1M1 12h1" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        const darkModeIconHtml = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M3 11.507a9.493 9.493 0 0018 4.219c-8.507 0-12.726-4.22-12.726-12.726A9.494 9.494 0 003 11.507z" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        const autoModeIconHtml = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M3 15c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.482 0 4.965-3 4.965-3s2.483 3 4.345 3M3 20c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.482 0 4.965-3 4.965-3s2.483 3 4.345 3M19 10a7 7 0 10-14 0" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

        let setThemeMode = function (currentTheme) {
            switch (currentTheme) {
            case 'light':
                lightTheme.disabled = false
                darkTheme.disabled = true
                darkThemeTableCss.disabled = true
                switchSpan.innerHTML = lightModeIconHtml

                if (!switchLightDarkModeOptions.switchDynamicPicture) return

                changeDynamicImageThemeMode(currentTheme)
                break
            case 'dark':
                lightTheme.disabled = true
                darkTheme.disabled = false
                darkThemeTableCss.disabled = false
                switchSpan.innerHTML = darkModeIconHtml

                if (!switchLightDarkModeOptions.switchDynamicPicture) return

                changeDynamicImageThemeMode(currentTheme)
                break
            case 'auto':
                var isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
                lightTheme.disabled = isDarkMode
                darkTheme.disabled = !isDarkMode
                darkThemeTableCss.disabled = !isDarkMode
                switchSpan.innerHTML = autoModeIconHtml
                
                if (!switchLightDarkModeOptions.switchDynamicPicture) return

                changeDynamicImageThemeMode(isDarkMode ? 'dark' : 'light')
                break
            }
        }

        setThemeMode(themeModes[currentThemeModeIndex])
        let preferredThemeChangeEventListenerFunction = function () {
            if (currentThemeModeIndex === 2) {
                setThemeMode(themeModes[currentThemeModeIndex])
            }
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', preferredThemeChangeEventListenerFunction)

        switchSpan.onclick = function (e) {
            if (currentThemeModeIndex === 2) {
                currentThemeModeIndex = 0
            }
            else {
                currentThemeModeIndex ++
            }
            setThemeMode(themeModes[currentThemeModeIndex])
        }

        document.body.appendChild(switchSpan)

        // 页面主题色
        var colorPickerSpan = document.createElement('span')
        colorPickerSpan.id = 'colorPickerSpan'
        initializeWidgetSpan (colorPickerSpan, 4)
        colorPickerSpan.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M7 13.161L12.4644 7.6966C12.8549 7.30607 13.4881 7.30607 13.8786 7.6966L15.9999 9.81792C16.3904 10.2084 16.3904 10.8416 15.9999 11.2321L14.0711 13.161M7 13.161L4.82764 15.3334C4.73428 15.4267 4.66034 15.5376 4.61007 15.6597L3.58204 18.1563C3.07438 19.3892 4.30728 20.6221 5.54018 20.1145L8.03681 19.0865C8.1589 19.0362 8.26981 18.9622 8.36317 18.8689L14.0711 13.161M7 13.161H14.0711" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.878 3.45401L15.9993 5.57533M20.242 9.81798L18.1206 7.69666M15.9993 5.57533L17.4135 4.16112C17.8041 3.7706 18.4372 3.7706 18.8277 4.16112L19.5349 4.86823C19.9254 5.25875 19.9254 5.89192 19.5349 6.28244L18.1206 7.69666M15.9993 5.57533L18.1206 7.69666" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

        var colorPickerPopupSpan = document.createElement('span')
        colorPickerPopupSpan.id = 'colorPickerPopupSpan'
        colorPickerPopupSpan.className = 'color-picker-popup-span color-picker-popup-span-disappear'
        colorPickerPopupSpan.style.position = 'fixed'
        colorPickerPopupSpan.style.right = (switchLightDarkModeOptions.right + 35).toString() + 'px'
        colorPickerPopupSpan.style.top = (switchLightDarkModeOptions.top + 100).toString() + 'px'
        var colorPickerPopupDiv = document.createElement('div')
        colorPickerPopupDiv.id = 'color-picker-popup-div'
        colorPickerPopupDiv.className = 'color-picker-popup-div'
        colorPickerPopupDiv.innerHTML = '<div class="color-picker-preset-color-list-div"><div class="color-picker-preset-color-btn-div" style="background-color: #eca2a2;" data-hue="0"></div><div class="color-picker-preset-color-btn-div" style="background-color: #ecc7a2;" data-hue="30"></div><div class="color-picker-preset-color-btn-div" style="background-color: #ececa2;" data-hue="60"></div><div class="color-picker-preset-color-btn-div" style="background-color: #c7eca2;" data-hue="90"></div><div class="color-picker-preset-color-btn-div" style="background-color: #a2ecec;" data-hue="180"></div><div class="color-picker-preset-color-btn-div" style="background-color: #aea2ec;" data-hue="250"></div><div class="color-picker-preset-color-btn-div" style="background-color: #c7a2ec;" data-hue="270"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2ec;" data-hue="300"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2c7;" data-hue="330"></div><div class="color-picker-preset-color-btn-div" style="background-color: #eca2b4;" data-hue="345"></div></div><input type="range" min="0" max="360" value="270" class="color-picker-slider" id="color-picker-slider" step="5">'

        colorPickerPopupSpan.appendChild(colorPickerPopupDiv)

        document.body.appendChild(colorPickerSpan)
        document.body.appendChild(colorPickerPopupSpan)

        colorPickerSlider = colorPickerPopupDiv.getElementsByClassName('color-picker-slider')[0]

        colorPickerSlider.oninput = function () {
            document.documentElement.style.setProperty('--theme-color', hslToHex(this.value, 66, 78))
            document.documentElement.style.setProperty('--global-theme-color-blur', hslToHex(this.value, 66, 78) + '1a')
        }

        Array.from(colorPickerPopupDiv.getElementsByClassName('color-picker-preset-color-btn-div')).forEach(colorPickerPresetColorBtn => {
            colorPickerPresetColorBtn.onclick = function (event) {
                document.documentElement.style.setProperty('--theme-color', hslToHex(event.target.dataset.hue, 66, 78))
                document.documentElement.style.setProperty('--global-theme-color-blur', hslToHex(event.target.dataset.hue, 66, 78) + '1a')
                colorPickerSlider.value = event.target.dataset.hue
            }
        })

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

        let iscolorPickerPopupOpen = false

        colorPickerSpan.onclick = function () {
            iscolorPickerPopupOpen = !iscolorPickerPopupOpen

            if (iscolorPickerPopupOpen) {
                colorPickerPopupSpan.classList.remove('color-picker-popup-span-disappear')
                colorPickerPopupSpan.classList.add('color-picker-popup-span-appear')
            }
            else {
                colorPickerPopupSpan.classList.remove('color-picker-popup-span-appear')
                colorPickerPopupSpan.classList.add('color-picker-popup-span-disappear')
            }
        }

        // 滚动到评论区
        var scrollToCommentSpan = document.createElement('span')
        scrollToCommentSpan.id = 'scrollToCommentSpan'
        initializeWidgetSpan (scrollToCommentSpan, 5)
        scrollToCommentSpan.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M17 12.5a.5.5 0 100-1 .5.5 0 000 1zM12 12.5a.5.5 0 100-1 .5.5 0 000 1zM7 12.5a.5.5 0 100-1 .5.5 0 000 1z" fill="var(--theme-color,#ea6f5a)" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22z" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

        scrollToCommentSpan.onclick = function () {
            document.getElementById('gitalk-container').scrollIntoView({ behavior: 'smooth', })
        }

        document.body.appendChild(scrollToCommentSpan)

        // 樱花雨特效
        let sakura = new Sakura('body')

        var showSakuraSpan = document.createElement('span')
        showSakuraSpan.id = 'showSakuraSpan'
        initializeWidgetSpan (showSakuraSpan, 6)
        showSakuraSpan.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM13 9s1-2 1-4-2-4-2-4-2 2-2 4 1 4 1 4" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9 11s-2-1-4-1-4 2-4 2 2 2 4 2 4-1 4-1M13 15s1 2 1 4-2 4-2 4-2-2-2-4 1-4 1-4M15 11s2-1 4-1 4 2 4 2-2 2-4 2-4-1-4-1M10.586 9.172S9.879 7.05 8.464 5.636C7.05 4.222 4.222 4.222 4.222 4.222s0 2.828 1.414 4.243c1.414 1.414 3.536 2.121 3.536 2.121M9.172 13.414s-2.122.707-3.536 2.122c-1.414 1.414-1.414 4.242-1.414 4.242s2.828 0 4.242-1.414c1.415-1.414 2.122-3.536 2.122-3.536M14.829 13.414s2.12.707 3.535 2.122c1.414 1.414 1.414 4.242 1.414 4.242s-2.828 0-4.242-1.414c-1.415-1.414-2.122-3.536-2.122-3.536M13.414 9.172s.707-2.122 2.122-3.536c1.414-1.414 4.242-1.414 4.242-1.414s0 2.828-1.414 4.243c-1.414 1.414-3.536 2.121-3.536 2.121" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

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

        // 隐藏显示小组件
        var showWidgetsSpan = document.createElement('span')
        showWidgetsSpan.id = 'showWidgetsSpan'
        initializeWidgetSpan (showWidgetsSpan, 7)
        showWidgetsSpan.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 12h7M15 12h7" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5"></path></svg>'

        let isWidgetsOpen = true

        showWidgetsSpan.onclick = function () {
            let widgetsSpanList = [
                switchSpan, 
                // zoomInSpan, 
                // zoomOutSpan, 
                // zoomDefaultSpan, 
                colorPickerSpan, 
                scrollToCommentSpan, 
                showSakuraSpan, 
            ]

            isWidgetsOpen = !isWidgetsOpen

            if (isWidgetsOpen) {
                widgetsSpanList.forEach(widget => {
                    widget.classList.remove('page-right-tools-widgets-span-disappear')
                    widget.classList.add('page-right-tools-widgets-span-appear')
                })
            }
            else {
                widgetsSpanList.forEach(widget => {
                    widget.classList.remove('page-right-tools-widgets-span-appear')
                    widget.classList.add('page-right-tools-widgets-span-disappear')
                })

                iscolorPickerPopupOpen = isWidgetsOpen

                if (iscolorPickerPopupOpen) {
                    colorPickerPopupSpan.classList.remove('color-picker-popup-span-disappear')
                    colorPickerPopupSpan.classList.add('color-picker-popup-span-appear')
                }
                else {
                    colorPickerPopupSpan.classList.remove('color-picker-popup-span-appear')
                    colorPickerPopupSpan.classList.add('color-picker-popup-span-disappear')
                }
            }
        }

        document.body.appendChild(showWidgetsSpan)
    })

    hook.afterEach(function (html, next) {
        next(html)

        if (!switchLightDarkModeOptions.switchDynamicPicture) return

        changeDynamicImageThemeMode(themeModes[currentThemeModeIndex])
    })
}

// Docsify plugin options
window.$docsify['switchLightDarkMode'] = Object.assign(
    switchLightDarkModeOptions,
    window.$docsify['switchLightDarkMode']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
