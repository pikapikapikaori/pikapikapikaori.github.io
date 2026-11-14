/*
 * 单位制排布。宽度与高度都以基准单位计数，裁切位置可选。
 * 列从上往下排，排满最大高度后向右接续；行内图片从左往右并排。
 * 列宽由该列最宽的一行决定。跳转地址只取公共照片清单的 link。
 * 每个槽位的宽高按单位换算，含单位之间的全部间隔，列底与行右边缘因此自然对齐。
 */
export const baseUnit = 10
export const maxHeightUnits = 5.625

/* 窄屏每列最宽 6 个单位；间隔只补在单位之间，故 6 个单位含 5 个间隔。 */
export const narrowUnitLimit = 6

/* 开发者开关：静止图片叠加做旧渐变；悬停、拖动与灯箱打开时不叠加。 */
export const agedFilter = true

export const columns = [
    {
        rows: [
            [
                { id: 'scenery-6', width: 6, height: 2.8125, position: '50% 48%' }
            ],
            [
                { id: 'figure-1', width: 3, height: 2.8125 },
                { id: 'scenery-3', width: 3, height: 2.8125 }
            ]
        ]
    },
    {
        rows: [
            [
                { id: 'scenery-5', width: 5, height: 5.625 }
            ]
        ]
    },
    {
        rows: [
            [
                { id: 'figure-2', width: 6, height: 2.8125 },
                { id: 'figure-7', width: 3, height: 2.8125 }
            ],
            [
                { id: 'figure-9', width: 3, height: 2.8125 },
                { id: 'figure-12', width: 6, height: 2.8125, position: '50% 32%' }
            ]
        ]
    }
]

/* 窄屏按照片顺序分三组，每组直接纵向排，不再按列高切列。 */
export const narrowColumns = [
    {
        rows: [
            [
                { id: 'scenery-6', width: 6, height: 2.8125, position: '50% 48%' }
            ],
            [
                { id: 'figure-1', width: 3, height: 2.8125 },
                { id: 'scenery-3', width: 3, height: 2.8125 }
            ]
        ]
    },
    {
        rows: [
            [
                { id: 'scenery-5', width: 6, height: 5 }
            ]
        ]
    },
    {
        rows: [
            [
                { id: 'figure-2', width: 6, height: 2.8125 }
            ],
            [
                { id: 'figure-7', width: 3, height: 2.8125 },
                { id: 'figure-9', width: 3, height: 2.8125 }
            ],
            [
                { id: 'figure-12', width: 6, height: 2.8125, position: '50% 32%' }
            ]
        ]
    }
]
