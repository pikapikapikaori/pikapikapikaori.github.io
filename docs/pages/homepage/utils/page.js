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
function getMsg() {
    var t = [
            'Don\'t worry<br>Be happy',
            '悲しみが終わらないのは<br>私達の力が足りないから',
            '憎しみが消えないのは<br>私達の愛がまだ足りないから',
            '古来聖賢皆寂寞<br>惟有飮者留其名',
            '歸去來兮<br>田園将蕪胡不歸',
            '世事漫隨流水<br>算來夢裏浮生<br>醉鄕路穩宜頻到<br>此外不堪行',
            '唯願當歌對酒時<br>月光長照金樽裏',
            '東船西舫悄無言<br>唯見江心秋月白',
            '酒旗戲鼓甚處市<br>想依稀<br>王謝鄰里',
            '問君何能爾<br>心遠地自偏',
        ],
        a = random(0, t.length - 1)
    $('#slogan').html(t[a])
}
function random(t, a) {
    var e = a - t,
        n = Math.random()
    return t + Math.round(n * e)
}
ctx.translate(x, y),
fireAnimate(),
$(function () {
    getMsg()
}),
(window.onscroll = function () {
    $(window).scrollTop() > 0.6 * $(window).height()
        ? $('.background').addClass('fixed')
        : $('.background').removeClass('fixed')
}),
$(function () {

}
)
