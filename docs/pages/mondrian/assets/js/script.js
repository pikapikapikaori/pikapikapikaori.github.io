(function () {
    const flipCards = document.querySelectorAll('.flip-card[data-flip]')

    function toggleFlip(card) {
        card.classList.toggle('flipped')
        const isFlipped = card.classList.contains('flipped')
        card.setAttribute('aria-pressed', isFlipped ? 'true' : 'false')
        card.setAttribute('aria-label', isFlipped ? '点击收起详情' : '点击翻转查看详情')
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
                this.setAttribute('aria-label', '点击翻转查看详情')
            }
        })
    })

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.flip-card')) {
            flipCards.forEach(card => {
                if (card.classList.contains('flipped')) {
                    card.classList.remove('flipped')
                    card.setAttribute('aria-pressed', 'false')
                    card.setAttribute('aria-label', '点击翻转查看详情')
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

    document.querySelectorAll('.link-cell, .link-cell-same').forEach(link => {
        const title = link.querySelector('.cell-title')
        if (title) {
            const text = title.textContent.trim()
            link.setAttribute('aria-label', `访问${text}`)
        }
    })

    console.log('%c Mondrian 10x10 + 功能规划完成',
        'background: #C41E3A; color: #fff; padding: 4px 12px; font-size: 14px; font-weight: bold; border-radius: 4px;'
    )
})()
