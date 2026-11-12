var sengine = 'https://www.google.com/search?q=' // Default search engine

function getParameterByName(name) {
    return new URLSearchParams(window.location.search).get(name)
}

function updatetime() {
    date()
    greet()
}

function start() {
    var query = getParameterByName('q')
    if (query) search(query.replaceAll('+', '%2B'))

    document.getElementById('keywords').focus()

    window.setInterval(function () {
        updatetime()
    }, 5000)
}

function handleKeyPress(e) {
    var key = e.keyCode || e.which
    var text = document.getElementById('keywords').value.replaceAll('+', '%2B')
    if (key == 13) {
        search(text)
    }
    if (key == 32) {
        document.getElementById('keywords').focus()
    }
}

function search(text) {
    var option = text.substr(1, text.indexOf(' ') - 1) || text.substr(1)
    var subtext = text.substr(2 + option.length)
    if (text[0] === '/') {
        if (text.indexOf(' ') > -1) {
            switch (option) {
                case 'sego':
                    window.location = 'https://www.google.com/search?q=' + subtext
                    break
                case 'sedd':
                    window.location = 'https://duckduckgo.com/?q=' + subtext
                    break
                case 'seqw':
                    window.location = 'https://www.qwant.com/?q=' + subtext
                    break
                case 'sebd':
                    window.location = 'https://www.baidu.com/s?wd=' + subtext
                    break
                case 'tvim':
                    window.location = 'https://www.imdb.com/find?q=' + subtext
                    break
                case 'tvtmdb':
                    window.location = 'https://www.themoviedb.org/search?query=' + subtext
                    break
                case 'tvtvdb':
                    window.location = 'https://www.thetvdb.com/search?query=' + subtext
                    break
                case 'tvtr':
                    window.location = 'https://trakt.tv/search?query=' + subtext
                    break
                case 'tvdb':
                    window.location = 'https://www.douban.com/search?q=' + subtext
                    break
                case 'muam':
                    window.location = 'https://www.allmusic.com/search/all/' + subtext
                    break
                case 'mudi':
                    window.location = 'https://www.discogs.com/search/?q=' + subtext
                    break
                case 'musc':
                    window.location = 'https://soundcloud.com/search?q=' + subtext
                    break
                case 'musp':
                    window.location = 'https://open.spotify.com/search/results/' + subtext
                    break
                case 'cord':
                    window.location = 'https://www.reddit.com/search?q=' + subtext
                    break
                case 'coyt':
                    window.location = 'https://www.youtube.com/results?search_query=' + subtext
                    break
                case 'cobgm':
                    window.location = 'https://bgm.tv/subject_search/' + subtext + '?cat=all'
                    break
                case 'degh':
                    window.location = 'https://github.com/search?q=' + subtext + '&type=repositories'
                    break
            }
        } else {
            switch (option) {
                case 'sego':
                    window.location = 'https://www.google.com'
                    break
                case 'sedd':
                    window.location = 'https://duckduckgo.com'
                    break
                case 'seqw':
                    window.location = 'https://www.qwant.com'
                    break
                case 'sebd':
                    window.location = 'https://www.baidu.com'
                    break
                case 'tvim':
                    window.location = 'https://www.imdb.com'
                    break
                case 'tvtmdb':
                    window.location = 'https://www.themoviedb.org'
                    break
                case 'tvtvdb':
                    window.location = 'https://www.thetvdb.com'
                    break
                case 'tvtr':
                    window.location = 'https://trakt.tv'
                    break
                case 'tvdb':
                    window.location = 'https://www.douban.com'
                    break
                case 'muam':
                    window.location = 'https://www.allmusic.com'
                    break
                case 'mudi':
                    window.location = 'https://www.discogs.com'
                    break
                case 'musc':
                    window.location = 'https://soundcloud.com'
                    break
                case 'musp':
                    window.location = 'https://open.spotify.com'
                    break
                case 'cord':
                    window.location = 'https://www.reddit.com'
                    break
                case 'coyt':
                    window.location = 'https://www.youtube.com'
                    break
                case 'cobgm':
                    window.location = 'https://bgm.tv'
                    break
                case 'degh':
                    window.location = 'https://github.com'
                    break
            }
        }
    } else if (validURL(text)) {
        if (containsProtocol(text))
            window.location = text
        else
            window.location = 'https://' + text
    } else {
        window.location = sengine + text
    }
}

// Source: https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i') // fragment locator
    return !!pattern.test(str)
}

function containsProtocol(str) {
    var pattern = new RegExp('^(https?:\\/\\/){1}.*', 'i')
    return !!pattern.test(str)
}

window.addEventListener('DOMContentLoaded', start)
