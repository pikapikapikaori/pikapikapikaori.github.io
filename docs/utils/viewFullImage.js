// Docsify plugin functions
function plugin(hook, vm) {

    let curImg = undefined

    let tarImageTop = '10%'
    let tarImageLeft = '10%'
    let tarImageWidth = '80%'
    let tarImageHeight = '80%'

    let keyframeDuration = 150
    let tarImageLeftStart = '-90%'
    let tarImageRightStart = '110%'

    function createImageOpenCloseKeyframe(tarImg, tarEl, isOpen) {
        let fullImageTop = tarImg.getBoundingClientRect().top + 'px'
        let fullImageLeft = tarImg.getBoundingClientRect().left + 'px'
        let fullImageWidth = tarImg.offsetWidth + 'px'
        let fullImageHeight = tarImg.offsetHeight + 'px'

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
        let viewFullImageSpan = document.createElement('span')

        viewFullImageSpan.id = 'view-full-image-span'

        let viewFullImageSpanInnerLeftDiv = document.createElement('div')
        let viewFullImageSpanInnerRightDiv = document.createElement('div')

        viewFullImageSpanInnerLeftDiv.id = 'view-full-image-span-inner-left-div'
        viewFullImageSpanInnerRightDiv.id = 'view-full-image-span-inner-right-div'
        viewFullImageSpanInnerLeftDiv.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="20px" height="20px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M15 6l-6 6 6 6" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        viewFullImageSpanInnerRightDiv.innerHTML = '<?xml version="1.0" encoding="UTF-8"?><svg width="20px" height="20px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--theme-color,#ea6f5a)"><path d="M9 6l6 6-6 6" stroke="var(--theme-color,#ea6f5a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

        let viewFullImageSpanInnerImgDiv = document.createElement('div')

        viewFullImageSpanInnerImgDiv.id = 'view-full-image-span-inner-img-div'

        let viewFullImageSpanInnerTextDiv = document.createElement('div')

        viewFullImageSpanInnerTextDiv.id = 'view-full-image-span-inner-text-div'

        viewFullImageSpan.appendChild(viewFullImageSpanInnerLeftDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerRightDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerImgDiv)
        viewFullImageSpan.appendChild(viewFullImageSpanInnerTextDiv)

        document.body.appendChild(viewFullImageSpan)

        // true for left button
        function buttonLeftRightOnClick(direction) {
            let viewFullImageSpanInnerImgDiv = document.getElementById('view-full-image-span-inner-img-div')
            let viewFullImageSpanInnerTextDiv = document.getElementById('view-full-image-span-inner-text-div')

            let imgArray = Array.from(document.getElementsByTagName('img')).filter(img => {
                return !(img.className.split(' ').indexOf('ignore-view-full-image-img') > -1 || img.className.indexOf('emoji') > -1 || img.src.indexOf('avatars.githubusercontent') > -1)
            })

            if (imgArray.length !== 1) {
                imgArray.some((img, index, arr) => {
                    if (viewFullImageSpanInnerImgDiv.style.backgroundImage.indexOf(img.src) > -1) {
                        let newImgIndex = direction ? (index === 0 ? imgArray.length - 1 : index - 1) : (index === imgArray.length - 1 ? 0 : index + 1)
                        viewFullImageSpanInnerImgDiv.style.backgroundImage = 'url(' + imgArray[newImgIndex].src + ')'
                        viewFullImageSpanInnerTextDiv.innerHTML = (newImgIndex + 1).toString() + ' / ' + arr.length.toString()
                        curImg = imgArray[newImgIndex]
    
                        createImageSwitchKeyframe (viewFullImageSpanInnerImgDiv, direction, 'url(' + imgArray[index].src + ')', 'url(' + imgArray[newImgIndex].src + ')')
                        return true
                    }
                })

            }
        }

        let notPreventParentOnClickEventElementId = [viewFullImageSpanInnerImgDiv.id, viewFullImageSpan.id, viewFullImageSpanInnerTextDiv.id,]

        viewFullImageSpan.onclick = async function (e) {
            if (notPreventParentOnClickEventElementId.indexOf(e.target.id) === -1) return
            if (curImg === undefined) return
            createImageOpenCloseKeyframe (curImg, viewFullImageSpanInnerImgDiv, false)
            await new Promise(r => setTimeout(r, keyframeDuration))
            this.style.display = 'none'
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
            return !(img.className.split(' ').indexOf('ignore-view-full-image-img') > -1 || img.className.indexOf('emoji') > -1 || img.src.indexOf('avatars.githubusercontent') > -1)
        }).forEach((img, index, arr) => {
            let viewFullImageSpan = document.getElementById('view-full-image-span')
            let viewFullImageSpanInnerImgDiv = document.getElementById('view-full-image-span-inner-img-div')
            let viewFullImageSpanInnerTextDiv = document.getElementById('view-full-image-span-inner-text-div')
            img.addEventListener('click', function () {
                curImg = img

                viewFullImageSpanInnerImgDiv.style.backgroundImage = 'url(' + img.src + ')'
                viewFullImageSpan.style.display = 'block'
                viewFullImageSpanInnerTextDiv.innerHTML = (index + 1).toString() + ' / ' + arr.length.toString()

                createImageOpenCloseKeyframe (curImg, viewFullImageSpanInnerImgDiv, true)
            })
        })
    })
}

window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
