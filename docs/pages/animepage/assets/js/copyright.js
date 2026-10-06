(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const year = new Date().getFullYear()
        const path = location.pathname
        const langMap = {
            '/en-us': 'Yi-Yang Li',
            '/jp': '<ruby>李亦楊<rt>リエキヨウ</rt></ruby>',
        }
        const lang = Object.keys(langMap).find(key => path.includes(key))
        const title = langMap[lang] || '李亦楊'
        document.getElementById('copyright-script-generated').innerHTML =
            `&copy; 2023 - ${year} ${title} - All Rights Reserved.`
    })
})()
