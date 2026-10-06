const dateConfig = new Map([
    ['zh-sc', 'zh-CN']
])

const greetKeys = ['night', 'morning', 'afternoon', 'evening']

const greetConfig = new Map([
    ['zh-sc', {
        morning: '早上好！',
        afternoon: '下午好！',
        evening: '晚上好！',
        night: '夜深了，晚安！'
    }],
    ['en', {
        morning: 'Good morning!',
        afternoon: 'Good afternoon!',
        evening: 'Good evening!',
        night: 'Good night!'
    }]
])

const lang = 'zh-sc'

function date() {
    let currentDate = new Date()
    let dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }
    let dateMsg = currentDate.toLocaleDateString(dateConfig.get(lang), dateOptions)
    document.getElementById('header_date').innerHTML = dateMsg
}

function greet() {
    let currentTime = new Date()
    let greetIndex = Math.floor(currentTime.getHours() / 6)
    const greetMsg = greetConfig.get(lang)
    document.getElementById('header_greet').innerHTML = greetMsg[greetKeys[greetIndex]]
}

function copyright() {
    const year = new Date().getFullYear()
    document.getElementById('copyright-script-generated').innerHTML =
        `&copy; 2023 - ${year} 李亦楊 - All Rights Reserved.`
}

function loadFunctions() {
    date()  
    greet()
    copyright()
}

document.addEventListener('DOMContentLoaded', loadFunctions)
