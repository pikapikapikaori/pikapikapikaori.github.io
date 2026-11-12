(window.requestAnimFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (t) {
        window.setTimeout(t, 1e3 / 60)
    }),
(window.onresize = function () {
    (c.width = cw = c.offsetWidth),
    (c.height = ch = c.offsetHeight),
    (ctx.fillStyle = 'rgba(21,21,21,1)'),
    ctx.fillRect(0, 0, cw, ch)
})
var cf = document.createElement('canvas'),
    c = document.getElementById('startrack');
(c.width = cf.width = cw = c.offsetWidth),
(c.height = cf.height = ch = c.offsetHeight)
var longside = Math.max(cw, ch);
(cf.width = 2.6 * longside), (cf.height = 2.6 * longside)
var ctx = c.getContext('2d'),
    cftx = cf.getContext('2d'),
    centerX = cw,
    centerY = 0,
    stars = [],
    drawTimes = 0
function rand(t, a) {
    var e = a - t,
        n = Math.random()
    return t + Math.round(n * e)
}
function createStar() {
    stars.push({
        x: rand(-cf.width, cf.width),
        y: rand(-cf.height, cf.height),
        size: 1,
        color: randomColor(),
    })
}
function randomColor() {
    return (
        'rgba(' +
        rand(120, 255) +
        ',' +
        rand(120, 255) +
        ',' +
        rand(120, 255) +
        ',' +
        rand(30, 100) / 100 +
        ')'
    )
}
function drawStar() {
    for (var t = stars.length; t--;) {
        var a = stars[t]
        cftx.beginPath(),
        cftx.arc(a.x, a.y, a.size, 0, 2 * Math.PI, !0),
        (cftx.fillStyle = a.color),
        cftx.closePath(),
        cftx.fill()
    }
}
function drawfromCache() {
    ctx.drawImage(cf, -cf.width / 2, -cf.height / 2)
}
function loop() {
    drawfromCache(),
    ++drawTimes > 150 &&
        drawTimes % 8 == 0 &&
        ((ctx.fillStyle = 'rgba(0,0,0,.04)'),
        ctx.fillRect(-3 * longside, -3 * longside, 6 * longside, 6 * longside)),
    rotateCanvas(0.025)
}
function rotateCanvas(t) {
    ctx.rotate((t * Math.PI) / 180)
}
(ctx.fillStyle = 'rgba(21,21,21,1)'),
ctx.fillRect(0, 0, cw, ch),
(ctx.lineCap = 'round')
for (var count = 2e4; count--;) createStar()
drawStar()
var x = centerX,
    y = centerY
function fireAnimate() {
    requestAnimFrame(fireAnimate), loop()
}
function changeStar() {
    loop = function () {
        drawfromCache(),
        ++drawTimes > 150 &&
            drawTimes % 8 == 0 &&
            ((ctx.fillStyle = 'rgba(0,0,0,.04)'),
            ctx.fillRect(-3 * longside, -3 * longside, 6 * longside, 6 * longside)),
        rotateCanvas(random(1, 100))
    }
}
function pickSlogan() {
    var list = window.App.i18n.list('hero.slogans')

    if (!list || !list.length) return

    var slogan = document.getElementById('slogan')

    if (slogan) slogan.innerHTML = list[Math.floor(Math.random() * list.length)]
}
function random(t, a) {
    var e = a - t,
        n = Math.random()
    return t + Math.round(n * e)
}
ctx.translate(x, y),
fireAnimate(),
window.App.i18n.onChange(pickSlogan),
(window.onscroll = function () {
    $(window).scrollTop() > 0.6 * $(window).height()
        ? $('.background').addClass('fixed')
        : $('.background').removeClass('fixed')
}),
$(function () {

}
)
