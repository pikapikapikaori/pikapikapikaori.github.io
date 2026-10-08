// Docsify plugin functions
function plugin(hook, vm) {

    let curImg = undefined

    const tarImageTop = '10%'
    const tarImageLeft = '10%'
    const tarImageWidth = '80%'
    const tarImageHeight = '80%'

    const keyframeDuration = 150
    const tarImageLeftStart = '-90%'
    const tarImageRightStart = '110%'

    let scrollLocked = false
    let lockWindowY = 0
    let lockContentY = 0

    let switchImageDirection = null

    // 滚轮节流锁
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
            return
        }

        if (!switchImageDirection) return

        if (e.key === 'ArrowLeft') {
            e.preventDefault()
            switchImageDirection(true)
        }
        else if (e.key === 'ArrowRight') {
            e.preventDefault()
            switchImageDirection(false)
        }
    }

    function lockScroll() {
        if (scrollLocked) return

        const content = document.querySelector('.content')
        lockWindowY = window.scrollY || document.documentElement.scrollTop || 0
        lockContentY = content ? content.scrollTop : 0
        scrollLocked = true

        window.addEventListener('wheel', preventWheel, { passive: false })
        window.addEventListener('touchmove', preventTouchMove, { passive: false })
        window.addEventListener('keydown', preventKeyScroll)

        // 只加状态类，不动任何布局样式
        document.body.classList.add('image-viewer-open')
    }

    function unlockScroll() {
        if (!scrollLocked) return
        scrollLocked = false

        window.removeEventListener('wheel', preventWheel)
        window.removeEventListener('touchmove', preventTouchMove)
        window.removeEventListener('keydown', preventKeyScroll)

        const content = document.querySelector('.content')
        if (window.scrollY !== lockWindowY) window.scrollTo(0, lockWindowY)
        if (content && content.scrollTop !== lockContentY) content.scrollTop = lockContentY

        document.body.classList.remove('image-viewer-open')
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
                keyframeDuration,
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
                keyframeDuration,
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
                keyframeDuration * 3,
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
                keyframeDuration * 3,
            )
        }
    }

    hook.mounted(function () {
        const viewFullImageSpan = document.createElement('span')

        viewFullImageSpan.id = 'view-full-image-span'

        const viewFullImageSpanInnerLeftDiv = document.createElement('div')
        const viewFullImageSpanInnerRightDiv = document.createElement('div')

        viewFullImageSpanInnerLeftDiv.id = 'view-full-image-span-inner-left-div'
        viewFullImageSpanInnerRightDiv.id = 'view-full-image-span-inner-right-div'
        viewFullImageSpanInnerLeftDiv.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M15 6l-6 6 6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        viewFullImageSpanInnerRightDiv.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color)"><path d="M9 6l6 6-6 6" stroke="var(--theme-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

        const viewFullImageSpanInnerImgDiv = document.createElement('div')

        viewFullImageSpanInnerImgDiv.id = 'view-full-image-span-inner-img-div'

        const viewFullImageSpanInnerTextDiv = document.createElement('div')

        viewFullImageSpanInnerTextDiv.id = 'view-full-image-span-inner-text-div'

        viewFullImageSpan.appendChild(viewFullImageSpanInnerLeftDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerRightDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerImgDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerTextDiv)

        document.body.appendChild(viewFullImageSpan)

        // true for left button
        function buttonLeftRightOnClick(direction) {
            const imgEl = document.getElementById('view-full-image-span-inner-img-div')
            const textEl = document.getElementById('view-full-image-span-inner-text-div')

            const imgArray = Array.from(document.getElementsByTagName('img')).filter(img => {
                const shouldIgnore =
                    img.classList.contains('ignore-view-full-image-img') ||
                    img.className.includes('emoji') ||
                    img.src.includes('avatars.githubusercontent')

                return !shouldIgnore
            })

            if (imgArray.length !== 1) {
                imgArray.some((img, index, arr) => {
                    if (imgEl.style.backgroundImage.indexOf(img.src) > -1) {
                        const newImgIndex = direction ? (index === 0 ? imgArray.length - 1 : index - 1) : (index === imgArray.length - 1 ? 0 : index + 1)
                        imgEl.style.backgroundImage = 'url(' + imgArray[newImgIndex].src + ')'
                        textEl.innerHTML = (newImgIndex + 1).toString() + ' / ' + arr.length.toString()
                        curImg = imgArray[newImgIndex]

                        createImageSwitchKeyframe(imgEl, direction, 'url(' + imgArray[index].src + ')', 'url(' + imgArray[newImgIndex].src + ')')
                        return true
                    }
                })
            }
        }

        // 暴露给 preventWheel / preventKeyScroll
        switchImageDirection = buttonLeftRightOnClick

        const notPreventParentOnClickEventElementId = [viewFullImageSpanInnerImgDiv.id, viewFullImageSpan.id, viewFullImageSpanInnerTextDiv.id]

        viewFullImageSpan.onclick = async function (e) {
            if (notPreventParentOnClickEventElementId.indexOf(e.target.id) === -1) return
            if (curImg === undefined) return
            createImageOpenCloseKeyframe(curImg, viewFullImageSpanInnerImgDiv, false)
            await new Promise(r => setTimeout(r, keyframeDuration))
            this.style.display = 'none'

            unlockScroll()
        }

        let touchStartX, touchEndX

        viewFullImageSpan.ontouchstart = function (e) {
            touchStartX = e.targetTouches[0].pageX
        }

        viewFullImageSpan.ontouchend = function (e) {
            touchEndX = e.changedTouches[0].pageX

            if (touchEndX - touchStartX > 40) {
                buttonLeftRightOnClick(true)
            }
            else if (touchEndX - touchStartX < -40) {
                buttonLeftRightOnClick(false)
            }
        }

        viewFullImageSpanInnerLeftDiv.onclick = function (e) {
            buttonLeftRightOnClick(true)
        }
        viewFullImageSpanInnerRightDiv.onclick = function (e) {
            buttonLeftRightOnClick(false)
        }
    })

    hook.doneEach(function () {
        Array.from(document.getElementsByTagName('img')).filter(img => {
            const shouldIgnore =
                img.classList.contains('ignore-view-full-image-img') ||
                img.className.includes('emoji') ||
                img.src.includes('avatars.githubusercontent')

            return !shouldIgnore
        }).forEach((img, index, arr) => {
            if (img.dataset.viewFullImageBound === '1') return
            img.dataset.viewFullImageBound = '1'

            const viewFullImageSpan = document.getElementById('view-full-image-span')
            const viewFullImageSpanInnerImgDiv = document.getElementById('view-full-image-span-inner-img-div')
            const viewFullImageSpanInnerTextDiv = document.getElementById('view-full-image-span-inner-text-div')

            img.addEventListener('click', function () {
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

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || [])
