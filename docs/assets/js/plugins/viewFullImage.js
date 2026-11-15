import { bindShortcuts } from '../utils/shortcut.js'
import { isEnabled } from '../utils/common.js'
import { docsifyClasses } from '../utils/constants.js'
import { viewFullImageIcons } from '../utils/icons.js'
import {
    tags,
    eventNames,
    on,
    off,
    addClass,
    removeClass,
    hasClass,
    createElement,
    queryAll,
    byId,
    byClass,
    getData,
    setData
} from '../utils/dom.js'

let viewFullImageOptions = {
    enable: false
}

export const ignoreViewFullImageClass = 'ignore-view-full-image-img'

export const imageViewerOpenClass = 'image-viewer-open'

function isIgnoredImage(img) {
    return hasClass(img, ignoreViewFullImageClass) ||
        img.className.includes('emoji') ||
        img.src.includes('avatars.githubusercontent')
}

function plugin(hook, vm) {
    if (!viewFullImageOptions.enable) return

    let curImg = undefined

    const tarImageTop = '10%'
    const tarImageLeft = '10%'
    const tarImageWidth = '80%'
    const tarImageHeight = '80%'

    const keyframeDuration = 150
    const keyframeEasing = 'cubic-bezier(0.25, 0.1, 0.25, 1)'
    const openCloseKeyframeDuration = 240
    const tarImageLeftStart = '-90%'
    const tarImageRightStart = '110%'

    let scrollLocked = false
    let lockWindowY = 0
    let lockContentY = 0

    let switchImageDirection = null
    let closeFullImage = null
    let unbindViewerShortcuts = null

    let wheelSwitchCooldown = false
    let wheelSwitchAccumulated = 0
    const wheelSwitchCooldownMs = 900
    const wheelSwitchThreshold = 20

    function preventWheel(e) {
        e.preventDefault()

        if (!switchImageDirection || wheelSwitchCooldown) return

        const absX = Math.abs(e.deltaX)
        const absY = Math.abs(e.deltaY)
        if (absX === 0 && absY === 0) return

        // 累加主导轴的幅度，微小抖动不触发
        const dominant = absX > absY ? absX : absY
        wheelSwitchAccumulated += dominant

        if (wheelSwitchAccumulated < wheelSwitchThreshold) return

        // 达到阈值，重置累加并进入冷却
        wheelSwitchAccumulated = 0
        wheelSwitchCooldown = true

        let direction
        if (absX > absY) {
            // 横向：向左滑 → 上一张，向右滑 → 下一张
            direction = e.deltaX < 0
        } else {
            // 纵向：向上滚 → 上一张，向下滚 → 下一张
            direction = e.deltaY < 0
        }

        switchImageDirection(direction)

        setTimeout(() => {
            wheelSwitchCooldown = false
            wheelSwitchAccumulated = 0
        }, wheelSwitchCooldownMs)
    }

    function preventTouchMove(e) {
        e.preventDefault()
    }

    function preventKeyScroll(e) {
        const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']
        if (scrollKeys.includes(e.key)) {
            e.preventDefault()
        }
    }

    function lockScroll() {
        if (scrollLocked) return

        const content = byClass(docsifyClasses.content)
        lockWindowY = window.scrollY || document.documentElement.scrollTop || 0
        lockContentY = content ? content.scrollTop : 0
        scrollLocked = true

        on(window, 'wheel', preventWheel, { passive: false })
        on(window, 'touchmove', preventTouchMove, { passive: false })
        on(window, eventNames.keydown, preventKeyScroll)

        unbindViewerShortcuts = bindShortcuts({
            ArrowLeft: { handler: () => switchImageDirection(true), repeat: true, allowInInput: true },
            ArrowRight: { handler: () => switchImageDirection(false), repeat: true, allowInInput: true },
            Escape: { handler: () => closeFullImage(), allowInInput: true }
        }, { when: () => scrollLocked })

        // 只加状态类，不动任何布局样式
        addClass(document.body, imageViewerOpenClass)
    }

    function unlockScroll() {
        if (!scrollLocked) return
        scrollLocked = false

        off(window, 'wheel', preventWheel)
        off(window, 'touchmove', preventTouchMove)
        off(window, eventNames.keydown, preventKeyScroll)

        if (unbindViewerShortcuts) {
            unbindViewerShortcuts()
            unbindViewerShortcuts = null
        }

        const content = byClass(docsifyClasses.content)
        if (window.scrollY !== lockWindowY) window.scrollTo(0, lockWindowY)
        if (content && content.scrollTop !== lockContentY) content.scrollTop = lockContentY

        removeClass(document.body, imageViewerOpenClass)
    }

    function createImageOpenCloseKeyframe(tarImg, tarEl, isOpen) {
        const fullImageTop = tarImg.getBoundingClientRect().top + 'px'
        const fullImageLeft = tarImg.getBoundingClientRect().left + 'px'
        const fullImageWidth = tarImg.offsetWidth + 'px'
        const fullImageHeight = tarImg.offsetHeight + 'px'

        if (isOpen) {
            tarEl.animate(
                [
                    {
                        top: fullImageTop,
                        left: fullImageLeft,
                        width: fullImageWidth,
                        height: fullImageHeight,
                    },
                    {
                        top: tarImageTop,
                        left: tarImageLeft,
                        width: tarImageWidth,
                        height: tarImageHeight,
                    },
                ],
                {
                    duration: openCloseKeyframeDuration,
                    easing: keyframeEasing,
                },
            )
        }
        else {
            tarEl.animate(
                [
                    {
                        top: tarImageTop,
                        left: tarImageLeft,
                        width: tarImageWidth,
                        height: tarImageHeight,
                    },
                    {
                        top: fullImageTop,
                        left: fullImageLeft,
                        width: fullImageWidth,
                        height: fullImageHeight,
                    },
                ],
                {
                    duration: openCloseKeyframeDuration,
                    easing: keyframeEasing,
                },
            )
        }
    }

    function createImageSwitchKeyframe(tarEl, direction, oldBackground, newBackground) {
        if (direction) {
            tarEl.animate(
                [
                    {
                        left: tarImageLeft,
                        display: 'inline',
                        backgroundImage: oldBackground,
                    },
                    {
                        left: tarImageRightStart,
                        display: 'inline',
                        backgroundImage: oldBackground,
                        offset: 0.45,
                    },
                    {
                        left: tarImageRightStart,
                        display: 'none',
                        backgroundImage: oldBackground,
                        offset: 0.47,
                    },
                    {
                        left: tarImageLeftStart,
                        display: 'none',
                        backgroundImage: oldBackground,
                        offset: 0.48,
                    },
                    {
                        left: tarImageLeftStart,
                        display: 'none',
                        backgroundImage: newBackground,
                        offset: 0.53,
                    },
                    {
                        left: tarImageLeftStart,
                        display: 'inline',
                        backgroundImage: newBackground,
                        offset: 0.55,
                    },
                    {
                        left: tarImageLeft,
                        display: 'inline',
                        backgroundImage: newBackground,
                    },
                ],
                {
                    duration: keyframeDuration * 3,
                    easing: keyframeEasing,
                },
            )
        }
        else {
            tarEl.animate(
                [
                    {
                        left: tarImageLeft,
                        display: 'inline',
                        backgroundImage: oldBackground,
                    },
                    {
                        left: tarImageLeftStart,
                        display: 'inline',
                        backgroundImage: oldBackground,
                        offset: 0.45,
                    },
                    {
                        left: tarImageLeftStart,
                        display: 'none',
                        backgroundImage: oldBackground,
                        offset: 0.47,
                    },
                    {
                        left: tarImageRightStart,
                        display: 'none',
                        backgroundImage: oldBackground,
                        offset: 0.48,
                    },
                    {
                        left: tarImageRightStart,
                        display: 'none',
                        backgroundImage: newBackground,
                        offset: 0.53,
                    },
                    {
                        left: tarImageRightStart,
                        display: 'inline',
                        backgroundImage: newBackground,
                        offset: 0.55,
                    },
                    {
                        left: tarImageLeft,
                        display: 'inline',
                        backgroundImage: newBackground,
                    },
                ],
                {
                    duration: keyframeDuration * 3,
                    easing: keyframeEasing,
                },
            )
        }
    }

    hook.mounted(function () {
        const viewFullImageSpan = createElement(tags.span)

        viewFullImageSpan.id = 'view-full-image-span'

        const viewFullImageSpanInnerLeftDiv = createElement(tags.div)
        const viewFullImageSpanInnerRightDiv = createElement(tags.div)

        viewFullImageSpanInnerLeftDiv.id = 'view-full-image-span-inner-left-div'
        viewFullImageSpanInnerRightDiv.id = 'view-full-image-span-inner-right-div'
        viewFullImageSpanInnerLeftDiv.innerHTML = viewFullImageIcons.prevArrow
        viewFullImageSpanInnerRightDiv.innerHTML = viewFullImageIcons.nextArrow

        const viewFullImageSpanInnerImgDiv = createElement(tags.div)

        viewFullImageSpanInnerImgDiv.id = 'view-full-image-span-inner-img-div'

        const viewFullImageSpanInnerTextDiv = createElement(tags.div)

        viewFullImageSpanInnerTextDiv.id = 'view-full-image-span-inner-text-div'

        viewFullImageSpan.appendChild(viewFullImageSpanInnerLeftDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerRightDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerImgDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerTextDiv)

        document.body.appendChild(viewFullImageSpan)

        function collectImages() {
            return queryAll(tags.img).filter(img => !isIgnoredImage(img))
        }

        function currentImageIndex(imgArray) {
            const imgEl = byId('view-full-image-span-inner-img-div')

            for (let i = 0; i < imgArray.length; i++) {
                if (imgEl.style.backgroundImage.indexOf(imgArray[i].src) > -1) return i
            }

            return -1
        }

        function updateCounter(textEl, index, count) {
            textEl.innerHTML = (index + 1).toString() + ' / ' + count.toString()
        }

        function showImage(imgArray, index, direction) {
            const imgEl = byId('view-full-image-span-inner-img-div')
            const textEl = byId('view-full-image-span-inner-text-div')

            const oldBackground = imgEl.style.backgroundImage
            const newBackground = 'url(' + imgArray[index].src + ')'

            imgEl.style.backgroundImage = newBackground
            curImg = imgArray[index]

            createImageSwitchKeyframe(imgEl, direction, oldBackground, newBackground)
            updateCounter(textEl, index, imgArray.length)
        }

        function buttonLeftRightOnClick(direction) {
            const imgArray = collectImages()
            if (imgArray.length <= 1) return

            const index = currentImageIndex(imgArray)
            if (index < 0) return

            const newImgIndex = direction ? index - 1 : index + 1
            if (newImgIndex < 0 || newImgIndex >= imgArray.length) return

            showImage(imgArray, newImgIndex, direction)
        }

        async function closeViewer() {
            if (!isEnabled(curImg)) return

            createImageOpenCloseKeyframe(curImg, viewFullImageSpanInnerImgDiv, false)
            await new Promise(r => setTimeout(r, openCloseKeyframeDuration))
            viewFullImageSpan.style.display = 'none'

            unlockScroll()
        }

        // 暴露给 preventWheel 与快捷键
        switchImageDirection = buttonLeftRightOnClick
        closeFullImage = closeViewer

        const notPreventParentOnClickEventElementId = [viewFullImageSpanInnerImgDiv.id, viewFullImageSpan.id, viewFullImageSpanInnerTextDiv.id]

        on(viewFullImageSpan, eventNames.click, function (e) {
            if (notPreventParentOnClickEventElementId.indexOf(e.target.id) === -1) return
            closeViewer()
        })

        let touchStartX, touchEndX

        on(viewFullImageSpan, eventNames.touchstart, function (e) {
            touchStartX = e.targetTouches[0].pageX
        })

        on(viewFullImageSpan, eventNames.touchend, function (e) {
            touchEndX = e.changedTouches[0].pageX

            if (touchEndX - touchStartX > 40) {
                buttonLeftRightOnClick(true)
            }
            else if (touchEndX - touchStartX < -40) {
                buttonLeftRightOnClick(false)
            }
        })

        on(viewFullImageSpanInnerLeftDiv, eventNames.click, function () {
            buttonLeftRightOnClick(true)
        })
        on(viewFullImageSpanInnerRightDiv, eventNames.click, function () {
            buttonLeftRightOnClick(false)
        })
    })

    hook.doneEach(function () {
        queryAll(tags.img).filter(img => !isIgnoredImage(img)).forEach((img, index, arr) => {
            if (getData(img, 'viewFullImageBound') === '1') return
            setData(img, 'viewFullImageBound', '1')

            const viewFullImageSpan = byId('view-full-image-span')
            const viewFullImageSpanInnerImgDiv = byId('view-full-image-span-inner-img-div')
            const viewFullImageSpanInnerTextDiv = byId('view-full-image-span-inner-text-div')

            on(img, eventNames.click, function () {
                curImg = img

                viewFullImageSpanInnerImgDiv.style.backgroundImage = 'url(' + img.src + ')'
                viewFullImageSpan.style.display = 'block'
                viewFullImageSpanInnerTextDiv.innerHTML = (index + 1).toString() + ' / ' + arr.length.toString()

                lockScroll()

                createImageOpenCloseKeyframe(curImg, viewFullImageSpanInnerImgDiv, true)
            })
        })
    })
}

window.$docsify['viewFullImage'] = Object.assign(
    viewFullImageOptions,
    window.$docsify['viewFullImage']
)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
