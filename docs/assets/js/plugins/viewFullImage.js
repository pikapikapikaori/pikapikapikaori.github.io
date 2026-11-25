import { bindShortcuts } from '../utils/shortcut.js'
import { docsifyClasses } from '../utils/constants.js'
import { arrow } from '../utils/icons.js'
import {
    onListen,
    offListen,
    addClass,
    removeClass,
    hasClass,
    createEl,
    getAllEls,
    getElById,
    getElByClass,
    getData,
    setData,
    setAttrs,
    setStyleProperty
} from '../utils/dom.js'

const imageIds = {
    viewer: 'view-full-image-span',
    left: 'view-full-image-span-inner-left-div',
    right: 'view-full-image-span-inner-right-div',
    image: 'view-full-image-span-inner-img-div',
    counter: 'view-full-image-span-inner-text-div',
}

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

function plugin(hook) {
    if (!viewFullImageOptions.enable) return

    let curImg = undefined
    let updateNavigation = null

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

    let wheelSwitchTimer = null
    let wheelSwitchAccumulated = 0
    const wheelSwitchCooldownMs = 900
    const wheelSwitchThreshold = 20

    function preventWheel(e) {
        e.preventDefault()

        if (!switchImageDirection || wheelSwitchTimer !== null) return

        const absX = Math.abs(e.deltaX)
        const absY = Math.abs(e.deltaY)
        if (absX === 0 && absY === 0) return

        const dominant = absX > absY ? absX : absY
        wheelSwitchAccumulated += dominant

        if (wheelSwitchAccumulated < wheelSwitchThreshold) return

        wheelSwitchAccumulated = 0

        let direction
        if (absX > absY) {
            direction = e.deltaX < 0
        } else {
            direction = e.deltaY < 0
        }

        switchImageDirection(direction)

        wheelSwitchTimer = setTimeout(() => {
            wheelSwitchTimer = null
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

    function closeOnEscape(e) {
        if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229 ||
            e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return

        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat) closeFullImage()
    }

    function lockScroll() {
        if (scrollLocked) return

        const content = getElByClass(docsifyClasses.content)
        lockWindowY = window.scrollY || document.documentElement.scrollTop || 0
        lockContentY = content ? content.scrollTop : 0
        scrollLocked = true

        onListen(window, 'wheel', preventWheel, { passive: false })
        onListen(window, 'touchmove', preventTouchMove, { passive: false })
        onListen(window, 'keydown', preventKeyScroll)
        onListen(window, 'keydown', closeOnEscape, true)

        unbindViewerShortcuts = bindShortcuts({
            ArrowLeft: { handler: () => switchImageDirection(true), repeat: true, allowInInput: true },
            ArrowRight: { handler: () => switchImageDirection(false), repeat: true, allowInInput: true }
        }, { when: () => scrollLocked })

        addClass(document.body, imageViewerOpenClass)
    }

    function unlockScroll(restoreScroll) {
        if (!scrollLocked) return
        scrollLocked = false

        offListen(window, 'wheel', preventWheel)
        offListen(window, 'touchmove', preventTouchMove)
        offListen(window, 'keydown', preventKeyScroll)
        offListen(window, 'keydown', closeOnEscape, true)

        clearTimeout(wheelSwitchTimer)
        wheelSwitchTimer = null
        wheelSwitchAccumulated = 0

        if (unbindViewerShortcuts) {
            unbindViewerShortcuts()
            unbindViewerShortcuts = null
        }

        if (restoreScroll) {
            const content = getElByClass(docsifyClasses.content)
            if (window.scrollY !== lockWindowY) window.scrollTo(0, lockWindowY)
            if (content && content.scrollTop !== lockContentY) content.scrollTop = lockContentY
        }

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
        const viewFullImageSpan = createEl('span')

        setAttrs(viewFullImageSpan, {id: imageIds.viewer})

        const viewFullImageSpanInnerLeftDiv = createEl('button', { attrs: { type: 'button' } })
        const viewFullImageSpanInnerRightDiv = createEl('button', { attrs: { type: 'button' } })

        setAttrs(viewFullImageSpanInnerLeftDiv, {id: imageIds.left})
        setAttrs(viewFullImageSpanInnerRightDiv, {id: imageIds.right})
        viewFullImageSpanInnerLeftDiv.innerHTML = arrow.prev
        viewFullImageSpanInnerRightDiv.innerHTML = arrow.next

        const viewFullImageSpanInnerImgDiv = createEl('div')

        setAttrs(viewFullImageSpanInnerImgDiv, {id: imageIds.image})

        const viewFullImageSpanInnerTextDiv = createEl('div')

        setAttrs(viewFullImageSpanInnerTextDiv, {id: imageIds.counter})

        viewFullImageSpan.appendChild(viewFullImageSpanInnerLeftDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerRightDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerImgDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerTextDiv)

        document.body.appendChild(viewFullImageSpan)

        function collectImages() {
            return getAllEls('img').filter(img => !isIgnoredImage(img))
        }

        function currentImageIndex(imgArray) {
            return imgArray.indexOf(curImg)
        }

        updateNavigation = function (imgArray, index) {
            viewFullImageSpanInnerLeftDiv.disabled = index <= 0
            viewFullImageSpanInnerRightDiv.disabled = index < 0 || index >= imgArray.length - 1
        }
        updateNavigation([], -1)

        function updateCounter(textEl, index, count) {
            textEl.innerHTML = (index + 1).toString() + ' / ' + count.toString()
        }

        function showImage(imgArray, index, direction) {
            const imgEl = getElById(imageIds.image)
            const textEl = getElById(imageIds.counter)

            const oldBackground = imgEl.style.backgroundImage
            const newBackground = 'url(' + imgArray[index].src + ')'

            setStyleProperty(imgEl, 'background-image', newBackground)
            curImg = imgArray[index]

            createImageSwitchKeyframe(imgEl, direction, oldBackground, newBackground)
            updateCounter(textEl, index, imgArray.length)
            updateNavigation(imgArray, index)
        }

        let closeTimer = null

        function buttonLeftRightOnClick(direction) {
            if (closeTimer !== null) return

            const imgArray = collectImages()
            if (imgArray.length <= 1) return

            const index = currentImageIndex(imgArray)
            if (index < 0) return

            const newImgIndex = direction ? index - 1 : index + 1
            if (newImgIndex < 0 || newImgIndex >= imgArray.length) return

            showImage(imgArray, newImgIndex, direction)
        }

        function resetViewer(restoreScroll) {
            clearTimeout(closeTimer)
            closeTimer = null
            curImg = undefined
            updateNavigation([], -1)
            setStyleProperty(viewFullImageSpan, 'display', 'none')
            viewFullImageSpanInnerImgDiv.getAnimations().forEach(animation => animation.cancel())
            setStyleProperty(viewFullImageSpanInnerImgDiv, 'background-image', '')
            viewFullImageSpanInnerTextDiv.textContent = ''
            unlockScroll(restoreScroll)
        }

        function closeViewer() {
            if (!curImg || closeTimer !== null) return

            const hash = window.location.hash
            viewFullImageSpanInnerImgDiv.getAnimations().forEach(animation => animation.cancel())
            createImageOpenCloseKeyframe(curImg, viewFullImageSpanInnerImgDiv, false)
            closeTimer = setTimeout(() => resetViewer(window.location.hash === hash), openCloseKeyframeDuration)
        }

        onListen(window, 'hashchange', () => {
            if (curImg) resetViewer(false)
        })

        switchImageDirection = buttonLeftRightOnClick
        closeFullImage = closeViewer

        const notPreventParentOnClickEventElementId = [viewFullImageSpanInnerImgDiv.id, viewFullImageSpan.id, viewFullImageSpanInnerTextDiv.id]

        onListen(viewFullImageSpan, 'click', function (e) {
            if (notPreventParentOnClickEventElementId.indexOf(e.target.id) === -1) return
            closeViewer()
        })

        let touchStartX, touchEndX

        onListen(viewFullImageSpan, 'touchstart', function (e) {
            touchStartX = e.targetTouches[0].pageX
        })

        onListen(viewFullImageSpan, 'touchend', function (e) {
            touchEndX = e.changedTouches[0].pageX

            if (touchEndX - touchStartX > 40) {
                buttonLeftRightOnClick(true)
            }
            else if (touchEndX - touchStartX < -40) {
                buttonLeftRightOnClick(false)
            }
        })

        onListen(viewFullImageSpanInnerLeftDiv, 'click', function () {
            buttonLeftRightOnClick(true)
        })
        onListen(viewFullImageSpanInnerRightDiv, 'click', function () {
            buttonLeftRightOnClick(false)
        })
    })

    hook.doneEach(function () {
        getAllEls('img').filter(img => !isIgnoredImage(img)).forEach(img => {
            if (getData(img, 'viewFullImageBound') === '1') return
            setData(img, 'viewFullImageBound', '1')

            const viewFullImageSpan = getElById(imageIds.viewer)
            const viewFullImageSpanInnerImgDiv = getElById(imageIds.image)
            const viewFullImageSpanInnerTextDiv = getElById(imageIds.counter)

            onListen(img, 'click', function () {
                curImg = img
                const images = getAllEls('img').filter(item => !isIgnoredImage(item))
                const index = images.indexOf(img)

                setStyleProperty(viewFullImageSpanInnerImgDiv, 'background-image', 'url(' + img.src + ')')
                setStyleProperty(viewFullImageSpan, 'display', 'block')
                viewFullImageSpanInnerTextDiv.textContent = (index + 1).toString() + ' / ' + images.length.toString()
                updateNavigation(images, index)

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
