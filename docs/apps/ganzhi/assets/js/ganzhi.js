function Lunar(date) {
    this.year = this.getDateData().year
    this.month = this.getDateData().month
    this.day = this.getDateData().day
    this.ylYear = 0
    this.ylMonth = 0
    this.ylDay = 0
    this._date = date ? date : null
    this._leap = 0
    this._leapDays = 0
    this._difDay = 0
    this._leapMonth = false

    this.checkDate()
    this.init()
}
Lunar.prototype.D = 0.2422

Lunar.prototype.C = [
    3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04,
    5.678, 21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042,
    8.318, 23.438, 7.438, 22.36, 7.18, 21.94, 5.4055, 20.12
]

Lunar.prototype.tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

Lunar.prototype.yearDiZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

Lunar.prototype.monthDiZhi = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']

// 1900年-2100年每年的农历月份信息。第一位表示闰月是大月（1）还是小月（0）。第二三四位转换成二进制表示每个月份是大月（1）还是小月（0）。最后一位表示闰月在第几月，为0表示没有闰月。
Lunar.prototype.dateInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
]

Lunar.prototype.jieqi = [
    '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
]

Lunar.prototype.checkDate = function () {
    let date = this._date
    if (!date) return
    if (!(/\d{4}-\d{1,2}-\d{1,2}/.test(date))) return

    date = date.split('-')
    if (parseInt(date[0]) % 4 !== 0 && parseInt(date[0]) % 100 !== 0 && parseInt(date[1]) === 2 && parseInt(date[2]) === 29) return
    if ((parseInt(date[1]) === 1 || parseInt(date[1]) === 3 || parseInt(date[1]) === 5 || parseInt(date[1]) === 7 || parseInt(date[1]) === 8 || parseInt(date[1]) === 10 || parseInt(date[1]) === 12) && parseInt(date[2]) > 31) return
    if ((parseInt(date[1]) === 4 || parseInt(date[1]) === 6 || parseInt(date[1]) === 9 || parseInt(date[1]) === 11) && parseInt(date[2]) > 30) return

    this.year = parseInt(date[0])
    this.month = parseInt(date[1])
    this.day = parseInt(date[2])
}

Lunar.prototype.init = function () {
    let firstDay = '01-31-1900'
    let newDay = this.month + '-' + this.day + '-' + this.year
    let offset = this.getDaysByDateString(firstDay, newDay)
    this._difDay = offset++
    let temp = 0
    let i = 1900
    for (i = 1900; i <= 2100 && offset > 0; i++) {
        temp = this.getYearDays(i)
        offset -= temp
    }
    if (offset <= 0) {
        offset += temp
        i--
    }
    this.ylYear = i
    let curMonthDays = this.monthDays(this.ylYear, 1)
    this._leap = this.leapMonth(this.ylYear)
    if (this._leap != 0) {
        this._leapDays = this.leapDays(this.ylYear)
    }
    let j = 1
    for (j = 1; j < 13 && curMonthDays < offset; curMonthDays = this.monthDays(this.ylYear, ++j)) {
        if (this._leap == j) {
            offset -= curMonthDays
            this._leapMonth = true
            if (offset > this._leapDays) {
                this._leapMonth = false
                offset -= this._leapDays
            } else {
                break
            }
        } else {
            offset -= curMonthDays
        }
    }

    this.ylMonth = j
    this.ylDay = offset
}

Lunar.prototype.getYearDays = function (year) {
    let sum = 348
    for (let i = 0x8000; i >= 0x10; i >>= 1) {
        sum += (this.dateInfo[year - 1900] & i) ? 1 : 0
    }
    let result = sum + this.leapDays(year)
    return result
}

Lunar.prototype.leapDays = function (year) {
    if (this.leapMonth(year)) {
        return (this.dateInfo[year - 1900] & 0x10000) ? 30 : 29
    } else {
        return (0)
    }
}

Lunar.prototype.leapMonth = function (year) {
    year = year ? year : this.ylYear
    return (this.dateInfo[year - 1900] & 0xf)
}

Lunar.prototype.monthDays = function (year, month) {
    return (this.dateInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29
}

Lunar.prototype.getLunarTime = function () {
    let dateStr = ''
    if (this._leapMonth) {
        dateStr += '闰'
    }
    const tmp = ['初', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '廿']
    if (this.ylMonth > 10) {
        const m2 = parseInt(this.ylMonth - 10)
        if (m2 === 1) {
            dateStr += '冬月'
        }
        if (m2 === 2) {
            dateStr += '腊月'
        }
    } else if (this.ylMonth == 1) {
        if (dateStr === '闰') {
            dateStr = '闰一月'
        } else {
            dateStr += '正月'
        }

    } else {
        dateStr += tmp[this.ylMonth] + '月'
    }

    if (this.ylDay < 11) {
        dateStr += '初' + tmp[this.ylDay]
    } else {
        let m1 = parseInt(this.ylDay / 10)
        if (m1 != 3) {
            dateStr += (m1 == 1) ? '十' : '廿'
            const m2 = this.ylDay % 10
            if (m2 == 0) {
                dateStr += '十'
            } else {
                dateStr += tmp[m2]
            }
        } else {
            dateStr += '三十'
        }
    }
    return dateStr
}

Lunar.prototype.getYearGanZhi = function (ylYear) {
    ylYear = ylYear ? ylYear : this.ylYear
    return this.getYearTianGan(ylYear) + this.getYearDiZhi(ylYear) + '年'
}

Lunar.prototype.getYearTianGan = function (ylYear) {
    ylYear = ylYear ? ylYear : this.ylYear
    return this.tianGan[(ylYear - 4) % 10]
}

Lunar.prototype.getYearDiZhi = function (ylYear) {
    ylYear = ylYear ? ylYear : this.ylYear
    return this.yearDiZhi[(ylYear - 4) % 12]
}

Lunar.prototype.getMonthGanZhi = function (ylYear, ylMonth) {
    ylYear = ylYear ? ylYear : this.ylYear
    ylMonth = ylMonth ? ylMonth : this.ylMonth
    return this.getMonthTianGan(ylYear) + this.getMonthDiZhi(ylMonth)
}

Lunar.prototype.getMonthTianGan = function (ylYear) {
    ylYear = ylYear ? ylYear : this.ylYear
    let jieQi = []
    let yearTianGan = this.getYearTianGan(ylYear)
    let monthFirstTianGan = '', monthTianGan = ''
    let offset = 0
    switch (yearTianGan) {
        case '甲':
        case '己':
            monthFirstTianGan = '丙'
            break
        case '乙':
        case '庚':
            monthFirstTianGan = '戊'
            break
        case '丙':
        case '辛':
            monthFirstTianGan = '庚'
            break
        case '丁':
        case '壬':
            monthFirstTianGan = '壬'
            break
        case '戊':
        case '癸':
            monthFirstTianGan = '甲'
            break
    }
    for (let i = 1; i < 13; i++) {
        jieQi.push(this.getJieQi(null, i))
    }
    jieQi.push(this.getJieQi(this.year + 1, 1))
    switch (true) {
        case (this.month == 1 && this.day >= jieQi[0]['小寒']):
            offset = -1
            break
        case (this.month == 1 && this.day < jieQi[0]['小寒']):
            offset = -2
            break
        case (this.month == 2 && this.day >= jieQi[1]['立春']):
            offset = 0
            break
        case (this.month == 2 && this.day < jieQi[1]['立春']):
            offset = -1
            break
        case (this.month == 3 && this.day >= jieQi[2]['惊蛰']):
            offset = 1
            break
        case (this.month == 3 && this.day < jieQi[2]['惊蛰']):
            offset = 0
            break
        case (this.month == 4 && this.day >= jieQi[3]['清明']):
            offset = 2
            break
        case (this.month == 4 && this.day < jieQi[3]['清明']):
            offset = 1
            break
        case (this.month == 5 && this.day >= jieQi[4]['立夏']):
            offset = 3
            break
        case (this.month == 5 && this.day < jieQi[4]['立夏']):
            offset = 2
            break
        case (this.month == 6 && this.day >= jieQi[5]['芒种']):
            offset = 4
            break
        case (this.month == 6 && this.day < jieQi[5]['芒种']):
            offset = 3
            break
        case (this.month == 7 && this.day >= jieQi[6]['小暑']):
            offset = 5
            break
        case (this.month == 7 && this.day < jieQi[6]['小暑']):
            offset = 4
            break
        case (this.month == 8 && this.day >= jieQi[7]['立秋']):
            offset = 6
            break
        case (this.month == 8 && this.day < jieQi[7]['立秋']):
            offset = 5
            break
        case (this.month == 9 && this.day >= jieQi[8]['白露']):
            offset = 7
            break
        case (this.month == 9 && this.day < jieQi[8]['白露']):
            offset = 6
            break
        case (this.month == 10 && this.day >= jieQi[9]['寒露']):
            offset = 8
            break
        case (this.month == 10 && this.day < jieQi[9]['寒露']):
            offset = 7
            break
        case (this.month == 11 && this.day >= jieQi[10]['立冬']):
            offset = 9
            break
        case (this.month == 11 && this.day < jieQi[10]['立冬']):
            offset = 8
            break
        case (this.month == 12 && this.day >= jieQi[11]['大雪']):
            offset = 10
            break
        case (this.month == 12 && this.day < jieQi[11]['大雪']):
            offset = 9
            break
    }
    if (offset + this.tianGan.indexOf(monthFirstTianGan) > 9) {
        monthTianGan = this.tianGan[offset + this.tianGan.indexOf(monthFirstTianGan) - 10]
    } else {
        monthTianGan = this.tianGan[offset + this.tianGan.indexOf(monthFirstTianGan)]
    }
    return monthTianGan
}

Lunar.prototype.getMonthDiZhi = function (ylMonth) {
    let month = ylMonth ? ylMonth : this.ylMonth
    return this.monthDiZhi[month - 1]
}

Lunar.prototype.getDayGanZhi = function () {
    return this.tianGan[this._difDay % 10] + this.yearDiZhi[(this._difDay + 4) % 12] + '日'
}

Lunar.prototype.getJieQi = function (year, month) {
    let min = 0, max = 0
    year = year ? year % 100 : this.year % 100
    month = month ? month : this.month
    if (month > 1) {
        min = 2 * month - 4
        max = 2 * month - 3
    } else {
        min = 22
        max = 23
    }
    let temp = {}
    if ((this.year === 1911 && month === 5) || (this.year === 1902 && month === 6) || ((this.year === 1925 || this.year === 2016) && month === 7) || (this.year === 1982 && month === 1) || (this.year === 2002 && month === 8) || (this.year === 1927 && month === 9) || (this.year === 2089 && month === 11) || (this.year === 1954 && month === 12)) {
        temp[this.jieqi[min]] = parseInt(year * this.D + this.C[min]) - Math.floor((year - 1) / 4) + 1
        temp[this.jieqi[max]] = parseInt(year * this.D + this.C[max]) - Math.floor((year - 1) / 4)
        return temp
    }
    if ((this.year === 2084 && month === 3) || (this.year === 2008 && month === 5) || (this.year === 1928 && month === 6) || (this.year === 1922 && month === 7) || (this.year === 1994 && month === 1) || (this.year === 2082 && month === 1) || (this.year === 1942 && month === 9) || (this.year === 2089 && month === 10) || (this.year === 1978 && month === 11)) {
        temp[this.jieqi[min]] = parseInt(year * this.D + this.C[min]) - Math.floor((year - 1) / 4)
        temp[this.jieqi[max]] = parseInt(year * this.D + this.C[max]) - Math.floor((year - 1) / 4) + 1
        return temp
    }
    if ((this.year === 2026 && month === 2) || (this.year === 1918 || this.year === 2021) && month === 7) {
        temp[this.jieqi[min]] = parseInt(year * this.D + this.C[min]) - Math.floor((year - 1) / 4)
        temp[this.jieqi[max]] = parseInt(year * this.D + this.C[max]) - Math.floor((year - 1) / 4) - 1
        return temp
    }
    if (this.year === 2019 && month === 1) {
        temp[this.jieqi[min]] = parseInt(year * this.D + this.C[min]) - Math.floor((year - 1) / 4) - 1
        temp[this.jieqi[max]] = parseInt(year * this.D + this.C[max]) - Math.floor((year - 1) / 4)
        return temp
    }

    temp[this.jieqi[min]] = parseInt(year * this.D + this.C[min]) - Math.floor((year - 1) / 4)
    temp[this.jieqi[max]] = parseInt(year * this.D + this.C[max]) - Math.floor((year - 1) / 4)
    return temp
}

Lunar.prototype.getDaysByDateString = function (dt1, dt2) {
    const dt1array = dt1.split('-')
    const dt2array = dt2.split('-')
    let startDate = new Date(dt1array[2], dt1array[0], dt1array[1])
    let endDate = new Date(dt2array[2], dt2array[0], dt2array[1])
    let diffDate = Math.abs(endDate - startDate)
    return Math.floor(diffDate / (1 * 24 * 60 * 60 * 1000))
}

Lunar.prototype.getDateData = function () {
    let date = new Date()
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
    }
}

let calculatorInput = document.getElementById('calculatorInput')
let calculatorOutputYear = document.getElementById('calculatorOutputYear')
let calculatorOutputMonth = document.getElementById('calculatorOutputMonth')
let calculatorOutputDay = document.getElementById('calculatorOutputDay')
let calculatorLunarOutput = document.getElementById('calculatorLunarOutput')
calculatorInput.valueAsDate = new Date()

function calculate() {
    let lunar = new Lunar(calculatorInput.value)
    calculatorOutputYear.innerHTML = lunar.getYearGanZhi()
    calculatorOutputMonth.innerHTML = lunar.getMonthGanZhi() + '月'
    calculatorOutputDay.innerHTML = lunar.getDayGanZhi()
    calculatorLunarOutput.innerHTML =  '农历' + lunar.getLunarTime()
}

calculate()

calculatorInput.addEventListener('keydown', function (event) {
    event.preventDefault()
})
calculatorInput.addEventListener('change', calculate)
