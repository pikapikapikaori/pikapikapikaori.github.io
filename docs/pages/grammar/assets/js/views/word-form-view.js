import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { submitWord, editWord, fetchWord } from '../services/word-service.js'
import { POS_LIST, normalizeParadigm } from '../models/word.js'
import { loadGrammar, getParadigmTemplate } from '../services/grammar-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'

const SOURCE_OPTIONS = [
    { value: 'manual', label: '手动' },
    { value: 'wiktionary', label: 'Wiktionary' }
]

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const { userId } = appStore.get()
        const lang = ctx.params.lang
        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' }, '未知语言：' + lang))
            return
        }

        const editId = ctx.params.id || null
        const isEdit = !!editId

        // 加载语法模板（如无则返回 null）
        const grammarDoc = await loadGrammar(lang)

        const data = isEdit ? await loadForEdit(editId) : emptyData()
        if (isEdit && !data) {
            replace(main, h('div', { class: 'empty' },
                h('div', { class: 'empty__title' }, '词条不存在'),
                h('button', {
                    class: 'btn btn--primary',
                    type: 'button',
                    onclick: () => location.hash = `#/lang/${lang}/words`
                }, '返回列表')
            ))
            return
        }

        function emptyData() {
            return {
                id: null,
                language: lang,
                lemma: '',
                pos: 'noun',
                inflectionType: { label: '', grammarRef: '' },
                paradigm: {},
                inflections: [],
                meanings: [{ text: '', lang: 'zh', source: 'manual' }],
                collocations: [],
                examples: [],
                derivatives: [],
                tags: [],
                notes: ''
            }
        }

        async function loadForEdit(id) {
            const w = await fetchWord(id)
            if (!w) return null
            return {
                id: w.id,
                language: w.language,
                lemma: w.lemma,
                pos: w.pos,
                inflectionType: {
                    label: (w.inflectionType && w.inflectionType.label) || '',
                    grammarRef: (w.inflectionType && w.inflectionType.grammarRef) || ''
                },
                paradigm: normalizeParadigm(w.paradigm),
                inflections: (w.inflections || []).map((x) => ({ ...x })),
                meanings: (w.meanings || []).map((x) => ({ ...x })),
                collocations: (w.collocations || []).map((x) => ({ ...x })),
                examples: (w.examples || []).map((x) => ({ ...x })),
                derivatives: [...(w.derivatives || [])],
                tags: [...(w.tags || [])],
                notes: w.notes || ''
            }
        }

        /* ---------- 顶部 ---------- */
        const head = h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    isEdit ? '编辑生词' : '添加生词'
                ),
                h('div', { class: 'page-head__sub' },
                    h('span', { lang: lang }, language.native),
                    ' · ', language.name
                )
            ),
            h('div', { class: 'page-head__actions' },
                h('button', {
                    class: 'btn', type: 'button',
                    onclick: () => location.hash = `#/lang/${lang}/words`
                }, '返回')
            )
        )

        /* ---------- 表单 ---------- */
        const form = h('form', {
            class: 'word-form',
            onsubmit: (e) => { e.preventDefault(); onSubmit() }
        })

        const lemmaInput = h('input', {
            class: 'input',
            type: 'text',
            placeholder: '基本形态',
            value: data.lemma,
            lang: lang,
            required: true,
            disabled: isEdit
        })

        const posSelect = h('select', {
            class: 'select',
            disabled: isEdit
        }, ...POS_LIST.map((p) => h('option', {
            value: p.value,
            selected: data.pos === p.value
        }, p.label)))

        // 词性变化时刷新 paradigm 表
        posSelect.addEventListener('change', () => {
            data.pos = posSelect.value
            renderParadigmBlock()
        })

        const inflectionLabel = h('input', {
            class: 'input',
            type: 'text',
            placeholder: '变格 / 变位类型（如：第一变位法）',
            value: data.inflectionType.label
        })

        const inflectionRef = h('input', {
            class: 'input',
            type: 'text',
            placeholder: '语法锚点 id（如：la-verb-1st-conj）',
            value: data.inflectionType.grammarRef
        })

        form.appendChild(h('div', { class: 'word-form__row' },
            field('基本形态', lemmaInput, '唯一键的一部分，同一语言下必须唯一。编辑时不可修改。'),
            field('词性', posSelect, '')
        ))

        form.appendChild(h('div', { class: 'word-form__row' },
            field('变格 / 变位类型', inflectionLabel, '显示在词卡正面的徽章。'),
            field('语法锚点', inflectionRef, '填写后点击徽章可跳转语法速查。')
        ))

        // 表格容器（由 renderParadigmBlock 填充）
        const paradigmSlot = h('div', {})
        form.appendChild(paradigmSlot)

        // 含义 / 补充形式 / 搭配 / 例句 / 派生 / 标签
        form.appendChild(buildMeaningGroup())
        form.appendChild(buildInflectionGroup())
        form.appendChild(buildCollocationGroup())
        form.appendChild(buildExampleGroup())
        form.appendChild(buildDerivativeGroup())
        form.appendChild(buildExtrasGroup())

        const submitBtn = h('button', {
            class: 'btn btn--primary',
            type: 'submit'
        }, isEdit ? '保存修改' : '添加')

        const cancelBtn = h('button', {
            class: 'btn',
            type: 'button',
            onclick: () => location.hash = `#/lang/${lang}/words`
        }, '取消')

        if (isEdit) {
            form.appendChild(h('div', { class: 'word-form__actions' },
                h('button', {
                    class: 'btn btn--danger',
                    type: 'button',
                    onclick: onDelete
                }, '删除'),
                h('div', { style: { flex: 1 } }),
                cancelBtn,
                submitBtn
            ))
        } else {
            form.appendChild(h('div', { class: 'word-form__actions' },
                cancelBtn,
                submitBtn
            ))
        }

        replace(main, head, form)

        renderParadigmBlock()

        /* ---------- 表格块渲染 ---------- */

        function renderParadigmBlock() {
            paradigmSlot.replaceChildren()
            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            if (!tpl) return

            const wrap = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, `${posLabel(data.pos)}变${data.pos === 'verb' ? '位' : '格'}表格`),
                    h('span', { class: 'field__hint' }, '仅填写你需要的形式，空白格不渲染')
                )
            )

            for (const tableTpl of tpl.tables || []) {
                const tableData = data.paradigm[tableTpl.key] || {}
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang,
                    mode: 'edit',
                    showTitle: true,
                    onGrammarRef: (ref) => {
                        location.hash = `#/grammar/${lang}#${ref}`
                    },
                    editable: {
                        onChange: (rowKey, colKey, value) => {
                            if (!data.paradigm[tableTpl.key]) data.paradigm[tableTpl.key] = {}
                            if (!data.paradigm[tableTpl.key][rowKey]) data.paradigm[tableTpl.key][rowKey] = {}
                            const s = String(value ?? '').trim()
                            if (s) data.paradigm[tableTpl.key][rowKey][colKey] = s
                            else delete data.paradigm[tableTpl.key][rowKey][colKey]
                        }
                    }
                })
                if (tbl) wrap.appendChild(tbl)
            }

            paradigmSlot.appendChild(wrap)
        }

        /* ---------- 其余分组（沿用旧实现） ---------- */

        function buildMeaningGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '含义'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                            renderMeanings()
                        }
                    }, '＋ 添加含义')
                ),
                list
            )

            function renderMeanings() {
                list.replaceChildren()
                data.meanings.forEach((m, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--meaning' },
                        h('input', {
                            class: 'input', placeholder: '含义', value: m.text,
                            lang: m.lang === 'en' ? 'en' : undefined,
                            oninput: (e) => { m.text = e.target.value }
                        }),
                        h('select', {
                            class: 'select',
                            onchange: (e) => { m.lang = e.target.value }
                        },
                        h('option', { value: 'zh', selected: m.lang === 'zh' }, '中文'),
                        h('option', { value: 'en', selected: m.lang === 'en' }, 'English')
                        ),
                        sourceSelect(m.source, (v) => { m.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm', type: 'button',
                            onclick: () => {
                                data.meanings.splice(idx, 1)
                                if (data.meanings.length === 0) {
                                    data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                                }
                                renderMeanings()
                            }
                        }, '✕')
                    ))
                })
            }
            renderMeanings()
            return group
        }

        function buildInflectionGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '补充形式（不定式、命令式、动名词、日语活用等）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.inflections.push({ group: '', label: '', form: '', source: 'manual' })
                            renderInflections()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            function renderInflections() {
                list.replaceChildren()
                data.inflections.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--inflection' },
                        h('input', {
                            class: 'input', placeholder: '分组（可选）', value: it.group || '',
                            oninput: (e) => { it.group = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '标签', value: it.label,
                            oninput: (e) => { it.label = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '形态', value: it.form, lang: lang,
                            oninput: (e) => { it.form = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm', type: 'button',
                            onclick: () => {
                                data.inflections.splice(idx, 1)
                                renderInflections()
                            }
                        }, '✕')
                    ))
                })
            }
            renderInflections()
            return group
        }

        function buildCollocationGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '固定搭配（可选）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.collocations.push({ text: '', gloss: '', source: 'manual' })
                            render()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            function render() {
                list.replaceChildren()
                data.collocations.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item' },
                        h('input', {
                            class: 'input', placeholder: '搭配文本', value: it.text, lang: lang,
                            oninput: (e) => { it.text = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '释义', value: it.gloss,
                            oninput: (e) => { it.gloss = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm', type: 'button',
                            onclick: () => { data.collocations.splice(idx, 1); render() }
                        }, '✕')
                    ))
                })
            }
            render()
            return group
        }

        function buildExampleGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '例句（可选）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.examples.push({ text: '', translation: '', citation: '', source: 'manual' })
                            render()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            function render() {
                list.replaceChildren()
                data.examples.forEach((it, idx) => {
                    list.appendChild(h('div', { style: { display: 'grid', gap: 'var(--sp-2)', padding: 'var(--sp-2) 0', borderBottom: '1px dashed var(--c-border)' } },
                        h('div', { class: 'word-form__item' },
                            h('input', {
                                class: 'input', placeholder: '例句原文', value: it.text, lang: lang,
                                oninput: (e) => { it.text = e.target.value }
                            }),
                            h('input', {
                                class: 'input', placeholder: '出处', value: it.citation,
                                oninput: (e) => { it.citation = e.target.value }
                            }),
                            sourceSelect(it.source, (v) => { it.source = v }),
                            h('button', {
                                class: 'btn btn--ghost btn--sm', type: 'button',
                                onclick: () => { data.examples.splice(idx, 1); render() }
                            }, '✕')
                        ),
                        h('input', {
                            class: 'input', placeholder: '译文', value: it.translation,
                            oninput: (e) => { it.translation = e.target.value }
                        })
                    ))
                })
            }
            render()
            return group
        }

        function buildDerivativeGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '派生词（可选）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => { data.derivatives.push(''); render() }
                    }, '＋ 添加')
                ),
                list
            )

            function render() {
                list.replaceChildren()
                data.derivatives.forEach((lemma, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item', style: { gridTemplateColumns: '1fr auto' } },
                        h('input', {
                            class: 'input', placeholder: '派生词的基本形态', value: lemma, lang: lang,
                            oninput: (e) => { data.derivatives[idx] = e.target.value }
                        }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm', type: 'button',
                            onclick: () => { data.derivatives.splice(idx, 1); render() }
                        }, '✕')
                    ))
                })
            }
            render()
            return group
        }

        function buildExtrasGroup() {
            const tagsInput = h('input', {
                class: 'input',
                placeholder: '标签，用逗号分隔（如 高频, 文献A）',
                value: data.tags.join(', ')
            })
            const notesInput = h('textarea', {
                class: 'textarea',
                placeholder: '备注',
                value: data.notes
            })
            return h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' }, h('span', {}, '标签与备注')),
                field('标签', tagsInput),
                field('备注', notesInput)
            )
        }

        /* ---------- 提交 ---------- */

        async function onSubmit() {
            const tagsRaw = form.querySelector('input[placeholder^="标签"]').value
            data.tags = tagsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)

            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('基本形态不能为空')
                lemmaInput.focus()
                return
            }

            const payload = {
                language: lang,
                lemma,
                pos: posSelect.value,
                inflectionType: {
                    label: inflectionLabel.value.trim(),
                    grammarRef: inflectionRef.value.trim() || null
                },
                paradigm: normalizeParadigm(data.paradigm),
                inflections: cleanList(data.inflections, ['form']),
                meanings: cleanList(data.meanings, ['text']),
                collocations: cleanList(data.collocations, ['text']),
                examples: cleanList(data.examples, ['text']),
                derivatives: data.derivatives.map((s) => s.trim()).filter(Boolean),
                tags: data.tags,
                notes: data.notes || ''
            }

            try {
                if (isEdit) {
                    await editWord(data.id, payload)
                    toast.success('已保存')
                } else {
                    const res = await submitWord(userId, lang, payload)
                    if (res.created) toast.success('已添加')
                    else toast.success(`「${lemma}」已存在，记录次数 +1`)
                }
                location.hash = `#/lang/${lang}/words`
            } catch (err) {
                console.error(err)
                if (String(err.name) === 'ConstraintError') {
                    toast.error('唯一键冲突：同语言下基本形态与词性已存在', 5000)
                } else {
                    toast.error(`保存失败：${err.message}`, 5000)
                }
            }
        }

        async function onDelete() {
            const ok = await confirmModal({
                title: '删除词条',
                message: `确定删除「${data.lemma}」？`,
                confirmLabel: '删除',
                danger: true
            })
            if (!ok) return
            const { deleteWord } = await import('../store/word-store.js')
            await deleteWord(data.id)
            toast.success('已删除')
            location.hash = `#/lang/${lang}/words`
        }
    }
}

function field(label, control, hint) {
    return h('label', { class: 'field' },
        h('span', { class: 'field__label' }, label),
        control,
        hint ? h('span', { class: 'field__hint' }, hint) : null
    )
}

function sourceSelect(value, onChange) {
    return h('select', {
        class: 'select',
        onchange: (e) => onChange(e.target.value)
    }, ...SOURCE_OPTIONS.map((o) => h('option', {
        value: o.value,
        selected: (value || 'manual') === o.value
    }, o.label)))
}

function cleanList(list, requiredKeys) {
    const out = []
    for (const item of list || []) {
        const copy = { ...item }
        const ok = requiredKeys.every((k) => String(copy[k] || '').trim())
        if (!ok) continue
        for (const k of Object.keys(copy)) {
            if (typeof copy[k] === 'string') copy[k] = copy[k].trim()
        }
        out.push(copy)
    }
    return out
}

function posLabel(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos
}
