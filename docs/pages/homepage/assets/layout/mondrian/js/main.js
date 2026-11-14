/*
 * 格子交互：翻转卡与提示语按模板类名对应，交互能力从原 mondrian 页 script.js 迁入：
 * 翻转卡点击与 Enter、空格翻转，Escape 收起，点画外收起全部，
 * 移动端双击防误触，语言切换后已展开的提示语立即更新。
 */
/* 格子排布属于本布局：列数、行数与区域定义在挂载时写入 CSS 变量。 */
const GRID = {
    columns: 10,
    rows: 10,
    areas: [
        'white-left white-left red red red red red red red red',
        'white-left white-left red red red red red red red red',
        'white-left white-left red red red red red red red red',
        'white-left white-left red red red red red red red red',
        'white-2 white-2 red red red red red red red red',
        'white-2 white-2 red red red red red red red red',
        'white-2 white-2 red red red red red red red red',
        'white-2 white-2 red red red red red red red red',
        'blue blue white-main white-main white-main white-main white-main white-main white-main white-small',
        'blue blue white-main white-main white-main white-main white-main white-main white-main yellow'
    ]
}

function applyGrid(root) {
    const grid = root.querySelector('.mondrian-grid')
    if (!grid) return

    grid.style.setProperty('--m-grid-columns', String(GRID.columns))
    grid.style.setProperty('--m-grid-rows', String(GRID.rows))
    grid.style.setProperty('--m-grid-areas', GRID.areas.map(function (row) {
        return '"' + row + '"'
    }).join(' '))
}

export default {
    mount(root) {
        const App = window.App
        const cards = [].slice.call(root.querySelectorAll('[data-m-flip]'))
        const slogan = root.querySelector('[data-slogan]')
        let unsubscribeSlogan = null

        applyGrid(root)

        function flipLabel(card) {
            return App.i18n.t(card.classList.contains('flipped')
                ? 'common.flip.close'
                : 'common.flip.open')
        }

        function toggleFlip(card) {
            card.classList.toggle('flipped')
            const flipped = card.classList.contains('flipped')

            card.setAttribute('aria-pressed', flipped ? 'true' : 'false')
            card.setAttribute('aria-label', flipLabel(card))
        }

        function closeFlip(card) {
            card.classList.remove('flipped')
            card.setAttribute('aria-pressed', 'false')
            card.setAttribute('aria-label', flipLabel(card))
        }

        function onCardClick(card) {
            toggleFlip(card)
        }

        function onCardKey(card, event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleFlip(card)
            } else if (event.key === 'Escape' && card.classList.contains('flipped')) {
                closeFlip(card)
            }
        }

        function onClick(event) {
            const card = event.target.closest('[data-m-flip]')

            if (card && root.contains(card)) {
                onCardClick(card)
            } else {
                cards.forEach(closeFlip)
            }
        }

        function onKey(event) {
            const card = event.target.closest('[data-m-flip]')

            if (!card || !root.contains(card)) return

            onCardKey(card, event)
        }

        /* 双击防误触：300ms 内两次 touchstart，第二次不触发点击。 */
        let lastTap = 0

        function onTouchStart(event) {
            const now = Date.now()

            if (now - lastTap < 300) event.preventDefault()
            lastTap = now
        }

        function pickSlogan() {
            if (!slogan) return

            /* 与星轨封面同池。红块横排，长条也可容纳。 */
            const list = App.i18n.list('common.slogans')

            if (!list || !list.length) return

            slogan.innerHTML = list[Math.floor(Math.random() * list.length)]
        }

        const unsubscribe = App.i18n.onChange(function () {
            cards.forEach(function (card) {
                if (card.classList.contains('flipped')) {
                    card.setAttribute('aria-label', flipLabel(card))
                }
            })
        })

        pickSlogan()
        unsubscribeSlogan = App.i18n.onChange(pickSlogan)

        root.addEventListener('click', onClick)
        root.addEventListener('keydown', onKey)
        root.addEventListener('touchstart', onTouchStart, { passive: false })
        cards.forEach(function (card) {
            card.setAttribute('aria-pressed', 'false')
            card.setAttribute('aria-label', flipLabel(card))
        })

        return {
            unmount() {
                root.removeEventListener('click', onClick)
                root.removeEventListener('keydown', onKey)
                root.removeEventListener('touchstart', onTouchStart)
                unsubscribe()
                if (unsubscribeSlogan) unsubscribeSlogan()
            }
        }
    }
}
