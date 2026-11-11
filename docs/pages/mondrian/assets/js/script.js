(function () {
    const App = window.App
    const flipCards = document.querySelectorAll('.flip-card[data-flip]')

    function flipLabel(card) {
        return App.i18n.t(card.classList.contains('flipped') ? 'flip.close' : 'flip.open')
    }

    function toggleFlip(card) {
        card.classList.toggle('flipped')
        const isFlipped = card.classList.contains('flipped')
        card.setAttribute('aria-pressed', isFlipped ? 'true' : 'false')
        card.setAttribute('aria-label', flipLabel(card))
    }

    flipCards.forEach(card => {
        card.setAttribute('aria-pressed', 'false')
        card.addEventListener('click', function (e) {
            if (e.target.closest('.flip-card')) {
                toggleFlip(this)
            }
        })
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleFlip(this)
            }
            if (e.key === 'Escape' && this.classList.contains('flipped')) {
                this.classList.remove('flipped')
                this.setAttribute('aria-pressed', 'false')
                this.setAttribute('aria-label', flipLabel(this))
            }
        })
    })

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.flip-card')) {
            flipCards.forEach(card => {
                if (card.classList.contains('flipped')) {
                    card.classList.remove('flipped')
                    card.setAttribute('aria-pressed', 'false')
                    card.setAttribute('aria-label', flipLabel(card))
                }
            })
        }
    })

    let lastTap = 0
    document.querySelectorAll('.flip-card').forEach(card => {
        card.addEventListener('touchstart', function (e) {
            const now = Date.now()
            if (now - lastTap < 300) {
                e.preventDefault()
            }
            lastTap = now
        }, { passive: false })
    })

    /* 语言切换后，已展开的卡片需要换成新语言的提示语 */
    App.i18n.onChange(function () {
        flipCards.forEach(card => {
            if (card.classList.contains('flipped')) {
                card.setAttribute('aria-label', flipLabel(card))
            }
        })
    })
})()
