import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { submitWord, editWord, fetchWord, queryWords } from '../services/word-service.js'
import {
    normalizeParadigm, normalizeStem, normalizeStems, normalizeGenders, sourceLabel
} from '../models/word.js'
import {
    loadGrammar, loadParadigmProfile, getParadigmTemplate, getDeriveSpec, getGenderOptions,
    getFieldDefs, fieldDefsOfTemplate, collectInflectAnchors, genderOfColumn, genderOfRow, termsOf, fillTerms
} from '../services/grammar-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { createGhostInput } from '../components/ghost-input.js'
import { createSelect } from '../components/select-field.js'
import { bdiNode, bdiText } from '../utils/bdi.js'
import { createTabGroup } from '../components/tabs.js'
import { generateParadigm, previewStem } from '../models/paradigm-generate.js'
import { toast } from '../components/toast.js'
import { confirmModal, openModal } from '../components/modal.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import {
    EXTERNAL_BASE, EXTERNAL_SOURCES, POS_LIST, GENDERS, WORD_SOURCE_OPTIONS
} from '../config/config.js'

const SPECIAL_REF = '__special__'
const INDECL_REF = '__indeclinable__'


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

        setBreadcrumbs([
            { label: '语言选择', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: isEdit ? '编辑生词' : '添加生词' }
        ])

        const grammarDoc = await loadGrammar(lang)

        // 外部数据源：按 config 清单逐个动态 import，缺文件 / 离线时跳过
        const externalSources = (await Promise.all(EXTERNAL_SOURCES.map(async (src) => {
            try {
                const mod = await import(new URL(`${src.file}.js`, EXTERNAL_BASE))
                if (typeof mod.lookupWordForForm !== 'function') {
                    console.warn(`[external] ${src.id} 没有导出 lookupWordForForm`)
                    return null
                }
                return { ...src, lookupWordForForm: mod.lookupWordForForm }
            } catch (err) {
                console.warn(`[external] ${src.id} 加载失败`, err)
                return null
            }
        }))).filter(Boolean)
        // 语言可以自定义「主要部分」的叫法与提示（如希伯来语是词根辅音）
        /** 当前词性的界面用词（各语言在自己的 JSON 里声明） */
        function currentTerms() { return termsOf(grammarDoc, posSelect.value) }

        /**
         * 说明文字（.field__hint）：内容来自语法 JSON，里面可能夹着原文
         * （如希伯来语的「词尾 ־ָה / ־ֶת 多为阴性」），同样按字符范围包 bdi。
         */
        function hintText(text) { return bdiText(text, lang) }

        /** 词性变了以后，界面上这些文案要跟着换（各词性可以有自己的说法） */
        function applyTerms() {
            const t = currentTerms()
            inflectionTypeLabelEl.textContent = t.inflectionType
            inflectionTypeHintEl.replaceChildren(hintText(t.inflectionTypeHint))
            anchorHintEl.replaceChildren(hintText(t.anchorHint))
            inflectionLabel.placeholder = t.inflectionTypePlaceholder
            stemsLabelEl.textContent = stemsMeta?.label || t.stems.label
            stemsHintEl.replaceChildren(hintText(stemsMeta?.hint || t.stems.hint))
            principalInput.placeholder = stemsMeta?.placeholder || t.stems.placeholder
            const extra = form.querySelector('.js-extra-forms-title')
            if (extra) extra.textContent = t.extraForms
        }
        const stemsMeta = grammarDoc?.stems && typeof grammarDoc.stems === 'object' ? grammarDoc.stems : null
        const paradigmProfile = await loadParadigmProfile(lang, grammarDoc)

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
                gender: [],
                attributes: {},
                inflectionType: { label: '', grammarRef: null },
                paradigm: {},
                stems: { base: '' },
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
                gender: normalizeGenders(w.gender, w.pos),
                attributes: { ...(w.attributes || {}) },
                inflectionType: {
                    label: (w.inflectionType && w.inflectionType.label) || '',
                    grammarRef: (w.inflectionType && w.inflectionType.grammarRef) || null
                },
                paradigm: normalizeParadigm(w.paradigm),
                stems: normalizeStems(w.stems),
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
                    bdiNode(language.native, lang),
                    ' · ', language.name
                )
            )
        )

        /* ---------- 表单 ---------- */
        const form = h('form', {
            class: 'word-form',
            onsubmit: (e) => { e.preventDefault(); onSubmit() }
        })

        /* ---------- 渲染函数（先声明，后赋值） ---------- */
        let renderMeanings = () => {}
        let renderInflections = () => {}
        let renderExamples = () => {}
        let renderCollocations = () => {}
        let renderDerivatives = () => {}
        let renderExtras = () => {}
        /** 切换「含义」的来源 tab（查询回填后跳到对应来源） */
        let setMeaningSource = () => {}
        /** 「标签」输入框（提交时读它） */
        let tagsInput = null

        const lemmaField = createGhostInput({
            value: data.lemma,
            lang,
            placeholder: '基本形态',
            disabled: isEdit,
            // 基本形态可以推出词干（stemForms.base.from = 'headword'）时影响 placeholder 预览
            onInput: () => {
                refreshStemGhosts()
                refreshGenerateBtn()
                refreshLookupBtn()
            }
        })
        const lemmaInput = lemmaField.input

        /* ---------- 外部数据源：按一次查全部，多个词性弹窗选 ---------- */

        /** 当前选中的变格 / 变位表（多表时用 tab 切换） */
        let paradigmTab = null
        /** 上一次由查询自动填的「变格 / 变位类型」文案，用于切换候选时判断能否覆盖 */
        let autoInflectionLabel = ''
        /** 正在套用查询结果时，词性变更不应触发「清空下面所有内容」 */
        let applyingLookup = false

        const lookupStatus = h('span', { class: 'field__hint lookup__status' }, '')

        const lookupBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => onLookupAll()
        }, '从来源查询')

        /** 没填基本形态就不能查：和「主要部分没填时生成表格」一样的禁用逻辑 */
        function refreshLookupBtn() {
            const has = Boolean(lemmaInput.value.trim()) && externalSources.length > 0
            lookupBtn.disabled = !has
            lookupBtn.title = has
                ? '从所有外部来源获取语法性、变格变位类型、语法锚点、主要部分与含义'
                : '请先填写基本形态'
        }

        const posSelect = h('select', {
            class: 'select',
            disabled: isEdit
        }, ...POS_LIST.map((p) => h('option', {
            value: p.value,
            selected: data.pos === p.value
        }, p.label)))

        let currentOptionsById = {}

        // 语法锚点：只列「变格 / 变位类型」，外加 特殊 / 不变
        // 类别名里带着原文（如希伯来语「III-ה 词根」），所以用自绘下拉，收起态也能包 bdi
        const inflectionRef = createSelect({
            lang,
            className: 'select',
            onChange: (v) => {
                const opt = currentOptionsById[v]
                // 换锚点就重写类型说明：特殊 → 清空待填；不变 → 用该语言的「不变形」；
                // 其余 → 锚点的短名（原来是「只在为空时填」，导致换了锚点内容不跟着变）
                if (v === SPECIAL_REF) inflectionLabel.value = ''
                else if (v === INDECL_REF) inflectionLabel.value = currentTerms().indeclinable
                else if (opt) inflectionLabel.value = opt.short || opt.label
                autoInflectionLabel = inflectionLabel.value
                renderExtraParts()
                renderParadigmBlock()
                refreshGenerateBtn()
            }
        })

        function rebuildRefOptions(initialValue) {
            const pos = posSelect.value
            const opts = collectInflectAnchors(grammarDoc, lang, pos)
            currentOptionsById = Object.fromEntries(opts.map((o) => [o.id, o]))

            // 该语言不启用变格变位表（paradigm: false），或该词性没有任何锚点：
            // 这一行整块隐藏，连「特殊 / 不变」两个内置项也不提供
            // （永远不变格变位的词性谈不上「特殊变格」，也没有「不变格」的对应关系）
            if (grammarDoc?.paradigm === false || !opts.length) {
                inflectionRef.setOptions([])
                inflectionRef.disabled = true
                inflectionRow.hidden = true
                inflectionLabel.value = ''
                data.inflectionType = { label: '', grammarRef: '' }
                renderExtraParts()
                refreshGenerateBtn()
                return
            }

            inflectionRow.hidden = false
            inflectionRef.disabled = false

            const prev = initialValue !== undefined ? initialValue : inflectionRef.value
            const ids = new Set(opts.map((o) => o.id))
            const selected = (prev && ids.has(prev))
                ? prev
                : (prev === INDECL_REF ? INDECL_REF : SPECIAL_REF)

            inflectionRef.setOptions([
                { value: SPECIAL_REF, label: currentTerms().special },
                { value: INDECL_REF, label: currentTerms().indeclinable },
                ...opts.map((o) => ({ value: o.id, label: o.label }))
            ], selected)
            renderExtraParts()
            generateBtn.hidden = !collectInflectAnchors(grammarDoc, lang, posSelect.value).length
            refreshGenerateBtn()
        }

        posSelect.addEventListener('change', () => {
            data.pos = posSelect.value
            // 手动词性切换：下面所有内容都属于旧词性，直接清空
            if (!applyingLookup) clearPosContent()

            const allowed = new Set(getFieldDefs(grammarDoc, data.pos).map((f) => f.key))
            for (const key of Object.keys(data.attributes)) {
                if (!allowed.has(key)) delete data.attributes[key]
            }
            applyTerms()
            updateStemsVisibility()
            rebuildRefOptions()
            renderGenderField()
            renderParadigmBlock()
        })

        /** 清掉词性相关的一切（换词性后旧内容不再适用） */
        function clearPosContent() {
            data.attributes = {}
            data.inflectionType = { label: '', grammarRef: '' }
            data.stems = { base: '' }
            data.paradigm = {}
            data.inflections = []
            data.collocations = []
            data.examples = []
            data.derivatives = []
            data.meanings = [{ text: '', lang: 'zh', source: 'manual' }]
            data.tags = []
            data.notes = ''

            appliedStems = {}
            autoInflectionLabel = ''
            inflectionLabel.value = ''
            principalInput.value = ''
            lookupStatus.textContent = ''
            lookupStatus.style.color = ''
            setMeaningSource('manual')

            renderGenderField()
            renderMeanings()
            renderInflections()
            renderCollocations()
            renderExamples()
            renderDerivatives()
            renderExtras()
            renderParadigmBlock()
            refreshGenerateBtn()
        }

        const inflectionField = createGhostInput({
            value: data.inflectionType.label,
            lang,
            placeholder: currentTerms().inflectionTypePlaceholder
        })
        const inflectionLabel = inflectionField.input

        const principalField = createGhostInput({
            value: data.stems.base || '',
            lang,
            placeholder: stemsMeta?.placeholder || currentTerms().stems.placeholder,
            getGhost: () => derivedBase(),
            onInput: () => { refreshStemGhosts(); refreshGenerateBtn() }
        })
        const principalInput = principalField.input

        // 额外的主要部分（由当前变位 / 变格类型的 derive.parts 决定）
        const extraPartsSlot = h('div', { class: 'field__parts' })
        // 额外主要部分的 ghost input 实例（刷新推导提示时用）
        let extraGhosts = []

        /** 该词性是否用「主要部分」：没有 paradigm 模板、或模板声明 stems: false 时不用 */
        function updateStemsVisibility() {
            const tpl = getParadigmTemplate(grammarDoc, posSelect.value)
            const needed = grammarDoc?.paradigm !== false && !!tpl && tpl.stems !== false
            stemsBlock.hidden = !needed
            generateBtn.hidden = !collectInflectAnchors(grammarDoc, lang, posSelect.value).length
            if (!needed) {
                for (const key of Object.keys(data.stems)) delete data.stems[key]
                principalInput.value = ''
            }
        }

        const generateBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: onGenerate
        }, '生成表格')

        /* ---------- 词性自己声明的属性字段（语法性 / 自他…） ---------- */

        const genderSlot = h('div', {})

        /** 词性自己声明的属性（语法性 / 自他…），和语法锚点一样用下拉 */
        function renderGenderField() {
            genderSlot.replaceChildren()
            const defs = getFieldDefs(grammarDoc, posSelect.value)
            // 没有属性字段的词性，整格隐藏，让后面两栏占满一行
            genderSlot.hidden = defs.length === 0
            if (!defs.length) return

            for (const def of defs) {
                // 语法性这类必填属性不提供空选项，没值时默认第一项
                const required = def.key === 'gender' || def.declensionCells
                const raw = data.attributes[def.key]
                let current = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
                if (!current && required && def.options.length) {
                    current = def.options[0].value
                    data.attributes[def.key] = current
                }

                const select = createSelect({
                    lang,
                    className: 'select',
                    value: current,
                    options: [
                        ...(required && current ? [] : [{ value: '', label: '（未选择）' }]),
                        ...def.options.map((opt) => ({ value: opt.value, label: opt.label }))
                    ],
                    onChange: (v) => {
                        if (v) data.attributes[def.key] = v
                        else delete data.attributes[def.key]
                        renderParadigmBlock()
                    }
                })

                genderSlot.appendChild(field(def.label, select, def.hint || '', lang))
            }
        }

        // 语法锚点下拉：特殊变格/变位 + 语法速查条目

        form.appendChild(h('div', { class: 'word-form__row word-form__card' },
            h('label', { class: 'field' },
                h('span', { class: 'field__label' }, '基本形态'),
                lemmaField.el,
                h('span', { class: 'field__hint' }, hintText('唯一键的一部分，同一语言下必须唯一。编辑时不可修改。'))
            ),
            h('div', { class: 'field' },
                h('span', { class: 'field__label' }, '词性'),
                h('div', { class: 'field__row' },
                    posSelect,
                    externalSources.length ? lookupBtn : null
                ),
                lookupStatus
            )
        ))

        const inflectionTypeLabelEl = h('span', { class: 'field__label' }, currentTerms().inflectionType)
        const inflectionTypeHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().inflectionTypeHint))
        const anchorHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().anchorHint))
        // 语法性之类的属性 + 类型 + 锚点：一行放不下时自适应换行
        const inflectionRow = h('div', { class: 'word-form__panel' },
            genderSlot,
            h('label', { class: 'field' }, h('span', { class: 'field__label' }, '语法锚点'), inflectionRef, anchorHintEl),
            h('label', { class: 'field' }, inflectionTypeLabelEl, inflectionField.el, inflectionTypeHintEl)
        )

        const stemsLabelEl = h('span', { class: 'field__label' }, stemsMeta?.label || currentTerms().stems.label)
        const stemsHintEl = h('span', { class: 'field__hint' }, hintText(stemsMeta?.hint || currentTerms().stems.hint))
        const stemsRow = h('label', { class: 'field' },
            stemsLabelEl,
            h('div', { class: 'field__row' }, principalField.el, generateBtn),
            stemsHintEl
        )

        // 主要部分 + 额外主要部分：放在变格 / 变位表头顶
        const stemsBlock = h('div', { class: 'word-form__stems' }, stemsRow, extraPartsSlot)

        // 字段顺序：基本形态+词性 → 属性/类型/锚点 → 含义 → 变格变位表（含主要部分）
        form.appendChild(inflectionRow)
        form.appendChild(buildMeaningGroup())

        const paradigmSlot = h('div', {})
        form.appendChild(paradigmSlot)

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

        rebuildRefOptions(data.inflectionType.grammarRef || SPECIAL_REF)
        replace(main, head, form)

        renderGenderField()
        updateStemsVisibility()
        renderParadigmBlock()
        refreshStemGhosts()
        refreshGenerateBtn()
        refreshLookupBtn()

        /* ---------- 按主要部分生成表格 ---------- */

        /** 当前「变格 / 变位类型」对应的生成规则 */
        function currentDeriveSpec() {
            const ref = inflectionRef.value
            if (!ref || ref === INDECL_REF) return null
            // 「特殊」也回退到词性的总规则，这样还能拿到声明的主要部分（如法语动词的助动词）；
            // 没有 endings 的总规则只用来渲染主要部分，不参与生成
            if (ref === SPECIAL_REF) return getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
            // 锚点自己没写规则时，退回该词性的总规则（如希伯来语名词：按基本形态判定元音模式）
            return getDeriveSpec(grammarDoc, ref) || getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
        }

        /** 当前锚点声明的主要部分（不含 base） */
        function currentParts() {
            const spec = currentDeriveSpec()
            if (!spec || !Array.isArray(spec.parts)) return []
            return spec.parts.filter((part) => part && part.key && part.key !== 'base')
        }

        /** 按当前锚点重建额外主要部分输入框；已填但新类型没有声明的部分丢弃 */
        function renderExtraParts() {
            extraGhosts = []
            const parts = currentParts()
            const allowed = new Set(['base', ...parts.map((p) => p.key)])
            for (const key of Object.keys(data.stems)) {
                if (!allowed.has(key)) delete data.stems[key]
            }

            extraPartsSlot.replaceChildren()
            if (!parts.length) return

            extraPartsSlot.appendChild(h('div', { class: 'field__hint' },
                hintText(currentTerms().extraPartsHint)))

            for (const part of parts) {
                const setValue = (raw) => {
                    const value = String(raw ?? '').trim()
                    if (value) data.stems[part.key] = value
                    else delete data.stems[part.key]
                    refreshStemGhosts()
                    refreshGenerateBtn()
                }
                // kind: 'select' —— 非词干类的元数据（如德语的助动词 haben / sein / beide）。
                // 这类字段没有空选项：没值时默认第一项并写进数据（助动词默认 haben / avoir）。
                const selectOptions = (part.options || [])
                    .map((opt) => ({ value: String(opt), label: String(opt) }))
                if (part.kind === 'select' && selectOptions.length && !data.stems[part.key]) {
                    data.stems[part.key] = selectOptions[0].value
                }
                const input = part.kind === 'select'
                    ? createSelect({
                        lang,
                        className: 'select',
                        value: data.stems[part.key] || '',
                        options: selectOptions,
                        onChange: (v) => setValue(v)
                    })
                    : ((ghost) => {
                        extraGhosts.push(ghost)
                        return ghost
                    })(createGhostInput({
                        value: data.stems[part.key] || '',
                        lang,
                        dataset: { partKey: part.key },
                        getGhost: () => derivedPart(part.key),
                        onInput: (e) => {
                            setValue(normalizeStem(e.target.value))
                            refreshStemGhosts()
                        }
                    })).el
                extraPartsSlot.appendChild(h('label', { class: 'field field--part' },
                    h('span', { class: 'field__label' }, part.label || part.key),
                    input,
                    part.hint ? h('span', { class: 'field__hint' }, hintText(part.hint)) : null
                ))
            }
            refreshStemGhosts()
        }

        /** 由基本形态 + 规则推出的词干（不含用户已填的 base） */
        function derivedBase() {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems.base
            const headword = normalizeStem(lemmaInput.value)
            return previewStem('', 'base', spec, { ...stems, headword })
        }

        /** 某个补充主要部分的推导值（忽略该框自己已填的内容） */
        function derivedPart(key) {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems[key]
            const headword = normalizeStem(lemmaInput.value)
            return previewStem(stems.base || derivedBase(), key, spec, { ...stems, headword })
        }

        /** 刷新所有主要部分输入框上的「推导提示」 */
        function refreshStemGhosts() {
            principalField.refresh()
            for (const item of extraGhosts) item.refresh()
        }

        /** 收集主要部分：base + 已填的额外部分 */
        function collectStems() {
            const stems = {}
            const base = normalizeStem(principalInput.value)
            if (base) stems.base = base
            for (const [key, value] of Object.entries(data.stems)) {
                if (key !== 'base' && value) stems[key] = normalizeStem(value)
            }
            return stems
        }

        /** 该词干变体是否能由规则/基本形态自动推出（空规则数组 `[]` 表示推不出） */
        function hasStemRule(form) {
            if (!form) return false
            if (typeof form === 'string') return !!form.trim()
            if (Array.isArray(form)) return form.length > 0
            if (typeof form === 'object') {
                if (form.from) return true
                return Array.isArray(form.rules) && form.rules.length > 0
            }
            return false
        }

        /** 必填但还没填的主要部分（有规则能自动推出的不算） */
        function missingRequiredParts(spec) {
            if (!spec || !Array.isArray(spec.parts)) return []
            return spec.parts
                .filter((part) => part && part.required === true && part.key !== 'base')
                .filter((part) => !hasStemRule(spec.stemForms && spec.stemForms[part.key]))
                .filter((part) => !(spec.stems && typeof spec.stems[part.key] === 'string'))
                .filter((part) => !String(data.stems[part.key] || '').trim())
                .map((part) => part.label || part.key)
        }

        function refreshGenerateBtn() {
            const spec = currentDeriveSpec()
            const canGenerate = !!spec && !!spec.endings && Object.keys(spec.endings).length > 0
            const hasStem = !!normalizeStem(principalInput.value)
            const missing = missingRequiredParts(spec)
            generateBtn.disabled = !canGenerate || !hasStem || missing.length > 0
            if (!canGenerate) generateBtn.title = '该变格 / 变位类型还没有自动生成规则'
            else if (!hasStem) generateBtn.title = '请先填写词干'
            else if (missing.length) generateBtn.title = `请先填写：${missing.join('、')}`
            else generateBtn.title = '按主要部分和词尾规则自动填表（会覆盖已填内容）'
            return missing
        }

        function onGenerate() {
            const spec = currentDeriveSpec()
            // partsOnly 的规则只提供主要部分，没有 endings，不能用来生成表格
            if (!spec || !spec.endings || !Object.keys(spec.endings).length) return

            const stem = normalizeStem(principalInput.value)
            if (!stem) {
                toast.error('请先填写词干')
                principalInput.focus()
                return
            }
            const missing = missingRequiredParts(spec)
            if (missing.length) {
                toast.error(`请先填写：${missing.join('、')}`, 5000)
                return
            }

            // 先把能推导出来的补充主要部分回填到输入框（生成时也用同一套值）
            {
                const headword = normalizeStem(lemmaInput.value)
                const filledParts = []
                const currentStems = collectStems()
                for (const part of currentParts()) {
                    if (String(data.stems[part.key] ?? '').trim()) continue
                    const value = previewStem(currentStems.base || '', part.key, spec,
                        { ...currentStems, headword })
                    if (!value) continue
                    data.stems[part.key] = value
                    filledParts.push(part.key)
                }
                if (filledParts.length) renderExtraParts()
            }

            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            const { paradigm, paradigmRoman, filled, noVariant, skippedTables } = generateParadigm({
                stem,
                stems: collectStems(),
                headword: lemmaInput.value,
                spec,
                template: tpl,
                existing: {},
                overwrite: true,
                profile: paradigmProfile
            })

            if (noVariant) {
                toast.error('按基本形态判不出元音模式，请检查基本形态的元音点，或手动填表', 6000)
                return
            }

            // 全量覆盖：本次生成的结果就是新的表格数据，没有生成的表一并清空
            data.paradigm = paradigm
            data.paradigmRoman = paradigmRoman
            for (const key of Object.keys(data.paradigmRoman)) {
                if (!Object.keys(data.paradigmRoman[key] || {}).length) delete data.paradigmRoman[key]
            }
            if (!Object.keys(data.paradigmRoman).length) delete data.paradigmRoman

            renderParadigmBlock()

            const titleOf = (tableKey) => (tpl?.tables || []).find((t) => t.key === tableKey)?.title || tableKey
            if (skippedTables.length) {
                const detail = skippedTables
                    .map((x) => `${titleOf(x.tableKey)}（缺 ${x.missing.join('、')}）`)
                    .join('、')
                toast.info(`已生成 ${filled.length} 格；以下表格因缺少主要部分组成，未生成并已清空：${detail}`, 8000)
            } else {
                toast.success(`已生成 ${filled.length} 格（已覆盖原有内容），请确认无误后保存`, 5000)
            }
        }

        /* ---------- 表格块渲染 ---------- */

        /** 只渲染所选「语法性」对应的格子：对不上的列 / 行都不渲染（性可能写在列上，也可能写在行上） */
        function hiddenGenderCells(tpl) {
            const empty = { columns: [], rows: [] }
            const field = fieldDefsOfTemplate(tpl, data.pos).find((f) => f.declensionCells)
            if (!field) return empty
            const raw = data.attributes[field.key]
            const picked = Array.isArray(raw) ? raw : (raw ? [raw] : [])
            if (!picked.length) return empty
            const hidden = { columns: [], rows: [] }
            for (const table of tpl?.tables || []) {
                for (const col of table.columns || []) {
                    const g = genderOfColumn(col.key)
                    if (g && !picked.includes(g)) hidden.columns.push(col.key)
                }
                for (const row of table.rows || []) {
                    const g = genderOfRow(row.key)
                    if (g && !picked.includes(g)) hidden.rows.push(row.key)
                }
            }
            return hidden
        }

        function renderParadigmBlock() {
            paradigmSlot.replaceChildren()
            if (grammarDoc?.paradigm === false) return
            // 选了「不变格 / 不变形 / 不变位」：没有变化表可填，整块（主要部分、标题、表格、横线）都不渲染
            if (inflectionRef.value === INDECL_REF) {
                paradigmSlot.hidden = true
                return
            }
            paradigmSlot.hidden = false
            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            if (!tpl) return

            // 锚点的 derive.skipTables：该类型没有的语式（如情态动词没有命令式）不渲染表格
            const spec = currentDeriveSpec()
            const skip = Array.isArray(spec?.skipTables) ? spec.skipTables : []

            const titleRow = h('div', { class: 'word-form__group-title' },
                h('span', {}, fillTerms(currentTerms().paradigmTitle, posLabel(data.pos)))
            )

            // 表可以声明 anchors：只在该锚点被选中时显示（代词的有性 / 无性表）
            // 模板里有表声明了 anchors 时，没选锚点（特殊 / 不变）只显示 default 的那张
            const ref = inflectionRef.value
            const anchored = (tpl.tables || []).some((t) => Array.isArray(t?.anchors))
            const noAnchor = !ref || ref === SPECIAL_REF || ref === INDECL_REF
            let tables = (tpl.tables || []).filter((t) => {
                if (skip.includes(t.key)) return false
                if (!anchored) return true
                if (!noAnchor && Array.isArray(t.anchors)) return t.anchors.includes(ref)
                return t.default === true
            })
            // 锚点没匹配到任何表（如选了父级代词、或数据没写全）时退回默认表
            if (!tables.length && anchored) {
                tables = (tpl.tables || []).filter((t) => t.default === true && !skip.includes(t.key))
            }
            // 只有一张表时，标题行直接占掉表格自带的标题位置（表格不再重复一遍）
            const singleTable = tables.length <= 1

            // 这个锚点没有对应的表（如代词的「特殊变形」）：只留主要部分，不画光秃秃的标题
            const wrap = h('div', { class: 'word-form__group' }, stemsBlock,
                tables.length ? titleRow : null)

            const panels = []
            const hiddenGender = hiddenGenderCells(tpl)
            for (const tableTpl of tables) {
                const tableData = data.paradigm[tableTpl.key] || {}
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang,
                    mode: 'edit',
                    // 单表用上面的标题行，多表用 tab 名，表内不再重复标题
                    showTitle: false,
                    hideColumns: hiddenGender.columns,
                    hideRows: hiddenGender.rows,
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
                if (tbl) panels.push({ key: tableTpl.key, label: tableTpl.title || tableTpl.key, node: tbl })
            }

            // 多张表用 tab 切换（输入内容在各表自己的数据里，切换不会丢）
            if (panels.length > 1) {
                if (!panels.some((p) => p.key === paradigmTab)) paradigmTab = panels[0].key
                wrap.appendChild(createTabGroup({
                    items: panels,
                    active: paradigmTab,
                    onChange: (key) => { paradigmTab = key },
                    className: 'tab-bar--tables'
                }).el)
            } else if (panels.length === 1) {
                wrap.appendChild(panels[0].node)
            }

            // 表格句尾提示
            wrap.appendChild(h('div', { class: 'field__hint word-form__table-hint' },
                hintText('仅填写你需要的形式，空白格不渲染')))

            paradigmSlot.appendChild(wrap)
        }

        /* ---------- 外部数据源查询（config.EXTERNAL_SOURCES） ---------- */

        /** 把查到的词条回填到表单：词性 / 属性 / 类型 / 锚点 / 主要部分 / 含义 */
        function applyEntry(entry, entries) {
            applyingLookup = true
            try {
                fillEntry(entry, entries)
            } finally {
                applyingLookup = false
            }
        }

        function fillEntry(entry, entries) {
            if (entry.pos && entry.pos !== posSelect.value) {
                // 借 change 事件走一遍词性切换的连带刷新（属性 / 锚点 / 表格）
                posSelect.value = entry.pos
                posSelect.dispatchEvent(new Event('change'))
            }

            const allowed = new Set(getFieldDefs(grammarDoc, posSelect.value).map((f) => f.key))
            for (const [key, value] of Object.entries(entry.patch.attributes || {})) {
                if (!allowed.has(key)) continue
                const v = String(value ?? '').trim()
                if (v) data.attributes[key] = v
            }
            renderGenderField()

            applyInflectionType(entry.patch.inflectionType)

            if (!stemsBlock.hidden) applyStems(entry.patch.stems)

            // 含义：所有来源里「同一个词性」的条目，各写进自己的来源
            const bySource = new Map()
            for (const e of entries) {
                if (e.pos !== entry.pos || bySource.has(e.sourceId)) continue
                if (e.patch.meanings?.length) bySource.set(e.sourceId, e.patch)
            }
            for (const [sourceId, patch] of bySource) {
                const items = patch.meanings.map((m) => ({
                    text: m.text,
                    lang: m.lang || 'en',
                    source: sourceId
                }))
                data.meanings = data.meanings.filter((m) => (m.source || 'manual') !== sourceId)
                data.meanings.push(...items)
            }
            if (!data.meanings.length) {
                data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
            }
            setMeaningSource(entry.sourceId)
            renderMeanings()
            // 属性（如语法性）变了要重画表格的列
            renderParadigmBlock()
        }

        /** 上一次查询填进去的主要部分（换词条时先撤掉，免得残留上一个词性的词干） */
        let appliedStems = {}

        function applyStems(stems) {
            for (const [key, value] of Object.entries(appliedStems)) {
                if (data.stems[key] === value) delete data.stems[key]
            }
            appliedStems = {}

            for (const [key, value] of Object.entries(stems || {})) {
                const stem = normalizeStem(value)
                if (!stem) continue
                data.stems[key] = stem
                appliedStems[key] = stem
            }

            principalInput.value = data.stems.base || ''
            renderExtraParts()
            refreshGenerateBtn()
        }

        /** 类型与锚点：只在没手改过文案时才覆盖 */
        function applyInflectionType(inflectionType) {
            const ref = inflectionType?.grammarRef
            if (!ref || !currentOptionsById[ref]) {
                // 新词条没有可靠锚点：撤掉上次自动填的类型文案
                if (autoInflectionLabel && inflectionLabel.value.trim() === autoInflectionLabel) {
                    inflectionLabel.value = ''
                }
                autoInflectionLabel = ''
                return
            }

            rebuildRefOptions(ref)
            const current = inflectionLabel.value.trim()
            if (!current || current === autoInflectionLabel) {
                autoInflectionLabel = inflectionType.label || currentOptionsById[ref].short || ''
                inflectionLabel.value = autoInflectionLabel
            }
            renderExtraParts()
        }

        /** 多个候选（多词性 / 多来源）时，弹窗让用户选一个 */
        function chooseEntry(entries, initial) {
            return new Promise((resolve) => {
                let picked = initial

                const items = entries.map((entry) => {
                    const btn = h('button', {
                        class: 'lookup-choice' + (entry === picked ? ' lookup-choice--active' : ''),
                        type: 'button',
                        onclick: () => {
                            picked = entry
                            for (const other of items) {
                                other.classList.toggle('lookup-choice--active', other === btn)
                            }
                        }
                    },
                    h('span', { class: 'lookup-choice__pos' }, posLabel(entry.pos)),
                    h('span', { class: 'lookup-choice__source' }, entry.sourceLabel),
                    h('span', { class: 'lookup-choice__label' }, entry.label)
                    )
                    return btn
                })

                openModal({
                    title: '选择词条',
                    body: h('div', {},
                        h('div', { class: 'field__hint' }, hintText('这一页有多个词条，选一个用来回填')),
                        h('div', { class: 'lookup-choices' }, ...items)
                    ),
                    actions: [
                        { label: '取消', onClick: () => resolve(null) },
                        { label: '使用所选', className: 'btn--primary', onClick: () => resolve(picked) }
                    ],
                    onClose: () => resolve(null)
                })
            })
        }

        async function onLookupAll() {
            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('请先输入基本形态')
                lemmaInput.focus()
                return
            }
            if (!externalSources.length) return

            lookupBtn.disabled = true
            lookupStatus.textContent = '查询中…'
            lookupStatus.style.color = ''

            try {
                const settled = await Promise.all(externalSources.map(async (source) => {
                    try {
                        const patch = await source.lookupWordForForm({
                            lemma,
                            langCode: lang,
                            preferredPos: posSelect.value,
                            grammarDoc
                        })
                        return { source, patch }
                    } catch (err) {
                        console.error(`[external] ${source.id}`, err)
                        return { source, error: err }
                    }
                }))

                const entries = []
                for (const { source, patch } of settled) {
                    if (!patch) continue
                    const choices = Array.isArray(patch.choices) && patch.choices.length
                        ? patch.choices
                        : [{ label: source.label, patch }]
                    for (const choice of choices) {
                        if (!choice?.patch) continue
                        entries.push({
                            sourceId: source.id,
                            sourceLabel: source.label,
                            pos: choice.patch.pos,
                            label: choice.label || source.label,
                            patch: choice.patch
                        })
                    }
                }

                if (!entries.length) {
                    lookupStatus.textContent = '所有来源都没有找到该词条'
                    lookupStatus.style.color = 'var(--c-fg-subtle)'
                    return
                }

                let picked = entries.find((e) => e.pos === posSelect.value) || entries[0]
                if (entries.length > 1) {
                    picked = await chooseEntry(entries, picked)
                    if (!picked) {
                        lookupStatus.textContent = '已取消'
                        lookupStatus.style.color = 'var(--c-fg-subtle)'
                        return
                    }
                }

                applyEntry(picked, entries)
                lookupStatus.textContent = `已从 ${picked.sourceLabel} 获取：${posLabel(picked.pos)}`
                lookupStatus.style.color = 'var(--c-success)'
                toast.success(`已从 ${picked.sourceLabel} 获取「${lemma}」`)
            } catch (err) {
                console.error(err)
                lookupStatus.textContent = `查询失败：${err.message}`
                lookupStatus.style.color = 'var(--c-danger)'
                toast.error(`查询失败：${err.message}`)
            } finally {
                lookupBtn.disabled = false
            }
        }

        /* ---------- 其余分组 ---------- */

        /** 「含义」按来源分 tab：手动 + 各外部源；切换只影响这一块 */
        function buildMeaningGroup() {
            let activeSource = 'manual'

            const tabs = h('div', { class: 'source-tabs word-form__meaning-tabs' })
            const list = h('div', { class: 'word-form__list' })
            const empty = h('div', { class: 'field__hint' }, hintText('该来源还没有含义'))

            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '含义'),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.meanings.push({ text: '', lang: 'zh', source: activeSource })
                            renderMeanings()
                        }
                    }, '＋ 添加含义')
                ),
                tabs,
                empty,
                list
            )

            /** tab 列表：手动 → 已注册的外部源 → 数据里出现的其它来源 */
            function meaningSources() {
                const ids = ['manual', ...externalSources.map((s) => s.id)]
                for (const m of data.meanings) {
                    const src = m.source || 'manual'
                    if (!ids.includes(src)) ids.push(src)
                }
                return ids
            }

            function renderTabs() {
                tabs.replaceChildren(...meaningSources().map((id) => h('button', {
                    class: 'source-tab' + (id === activeSource ? ' source-tab--active' : ''),
                    type: 'button',
                    role: 'tab',
                    'aria-selected': String(id === activeSource),
                    onclick: () => {
                        activeSource = id
                        renderMeanings()
                    }
                },
                h('span', { class: 'source-tab__dot' }),
                sourceLabel(id)
                )))
            }

            setMeaningSource = (id) => {
                if (!id) return
                activeSource = id
            }

            renderMeanings = function () {
                renderTabs()
                list.replaceChildren()

                const rows = data.meanings
                    .map((m, idx) => ({ m, idx }))
                    .filter(({ m }) => (m.source || 'manual') === activeSource)

                empty.hidden = rows.length > 0

                for (const { m, idx } of rows) {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--meaning' },
                        createGhostInput({
                            value: m.text,
                            lang: m.lang === 'en' ? 'en' : null,
                            bdiLang: lang,
                            placeholder: '含义',
                            onInput: (e) => { m.text = e.target.value }
                        }).el,
                        h('select', {
                            class: 'select',
                            onchange: (e) => { m.lang = e.target.value }
                        },
                        h('option', { value: 'zh', selected: m.lang === 'zh' }, '中文'),
                        h('option', { value: 'en', selected: m.lang === 'en' }, 'English')
                        ),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该含义',
                            onclick: () => {
                                data.meanings.splice(idx, 1)
                                if (!data.meanings.length) {
                                    data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                                }
                                renderMeanings()
                            }
                        }, '✕')
                    ))
                }
            }
            renderMeanings()
            return group
        }

        function buildInflectionGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', { class: 'js-extra-forms-title' }, currentTerms().extraForms),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.inflections.push({ group: '', label: '', form: '', source: 'manual' })
                            renderInflections()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            renderInflections = function () {
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
                        createGhostInput({
                            value: it.form,
                            lang,
                            placeholder: '形态',
                            onInput: (e) => { it.form = e.target.value }
                        }).el,
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该形式',
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
                        class: 'btn btn--sm', type: 'button',
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
                        createGhostInput({
                            value: it.text,
                            lang,
                            placeholder: '搭配文本',
                            onInput: (e) => { it.text = e.target.value }
                        }).el,
                        h('input', {
                            class: 'input', placeholder: '释义', value: it.gloss,
                            oninput: (e) => { it.gloss = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该搭配',
                            onclick: () => { data.collocations.splice(idx, 1); renderCollocations() }
                        }, '✕')
                    ))
                })
            }
            renderCollocations()
            return group
        }

        function buildExampleGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '例句（可选）'),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.examples.push({ text: '', translation: '', citation: '', source: 'manual' })
                            renderExamples()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            renderExamples = function () {
                list.replaceChildren()
                data.examples.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--example' },
                        createGhostInput({
                            value: it.text,
                            lang,
                            placeholder: '例句原文',
                            onInput: (e) => { it.text = e.target.value }
                        }).el,
                        h('input', {
                            class: 'input', placeholder: '出处', value: it.citation,
                            oninput: (e) => { it.citation = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('input', {
                            class: 'input word-form__cell--wide', placeholder: '译文', value: it.translation,
                            oninput: (e) => { it.translation = e.target.value }
                        }),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该例句',
                            onclick: () => { data.examples.splice(idx, 1); renderExamples() }
                        }, '✕')
                    ))
                })
            }
            renderExamples()
            return group
        }

        function buildDerivativeGroup() {
            const selected = h('div', { class: 'chip-group' })
            const results = h('div', { class: 'picker-results' })
            const hint = h('div', { class: 'field__hint' }, '')

            const searchField = createGhostInput({
                lang,
                placeholder: '搜索本语言词库（基本形态 / 主要部分）…',
                onInput: () => scheduleSearch()
            })
            const searchInput = searchField.input

            let timer = null
            let seq = 0

            function scheduleSearch() {
                clearTimeout(timer)
                timer = setTimeout(runSearch, 180)
            }

            async function runSearch() {
                const q = searchInput.value.trim()
                results.replaceChildren()
                if (!q) {
                    hint.textContent = ''
                    return
                }

                const mySeq = ++seq
                const res = await queryWords(userId, lang, {
                    q,
                    scope: 'head',      // 只检索基本形态 + 主要部分
                    page: 1,
                    pageSize: 50
                })
                if (mySeq !== seq) return

                const items = res.items.filter((w) => w.lemma !== lemmaInput.value.trim())
                if (!items.length) {
                    hint.textContent = '未找到，请先添加该词'
                    return
                }
                hint.textContent = ''

                for (const w of items) {
                    const picked = data.derivatives.includes(w.lemma)
                    results.appendChild(h('button', {
                        class: 'picker-item' + (picked ? ' picker-item--picked' : ''),
                        type: 'button',
                        onclick: () => {
                            const i = data.derivatives.indexOf(w.lemma)
                            if (i >= 0) data.derivatives.splice(i, 1)
                            else data.derivatives.push(w.lemma)
                            renderSelected()
                            runSearch()
                        }
                    },
                    h('span', { class: 'picker-item__lemma', lang }, w.lemma),
                    h('span', { class: 'picker-item__pos' }, posLabel(w.pos)),
                    h('span', { class: 'picker-item__gloss' },
                        (w.meanings || []).map((m) => m.text).filter(Boolean).join('；'))
                    ))
                }
            }

            function renderSelected() {
                selected.replaceChildren()
                if (!data.derivatives.length) {
                    selected.appendChild(h('span', { class: 'field__hint' }, hintText('尚未选择派生词')))
                    return
                }
                for (const lemma of data.derivatives) {
                    selected.appendChild(h('span', { class: 'chip chip--active' },
                        h('span', { lang }, lemma),
                        h('button', {
                            class: 'chip__remove',
                            type: 'button',
                            'aria-label': `移除 ${lemma}`,
                            onclick: () => {
                                data.derivatives = data.derivatives.filter((x) => x !== lemma)
                                renderSelected()
                                runSearch()
                            }
                        }, '✕')
                    ))
                }
            }

            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '派生词（可选）')
                ),
                h('div', { class: 'derivative-picker' },
                    selected,
                    h('div', { class: 'field' },
                        searchField.el,
                        h('span', { class: 'field__hint' }, hintText('只能选择词库中已存在的词')),
                        hint
                    ),
                    results
                )
            )

            renderDerivatives = renderSelected
            renderSelected()
            return group
        }

        function buildExtrasGroup() {
            tagsInput = h('input', {
                class: 'input',
                placeholder: '标签，用逗号分隔（如 高频, 文献A）',
                value: data.tags.join(', ')
            })
            const notesInput = h('textarea', {
                class: 'textarea',
                placeholder: '备注',
                value: data.notes
            })
            renderExtras = () => {
                tagsInput.value = data.tags.join(', ')
                notesInput.value = data.notes || ''
            }

            return h('div', { class: 'word-form__group word-form__extras' },
                field('标签', tagsInput, '', lang),
                field('备注', notesInput, '', lang)
            )
        }

        /* ---------- 提交 ---------- */

        async function onSubmit() {
            const tagsRaw = tagsInput.value
            data.tags = tagsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)

            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('基本形态不能为空')
                lemmaInput.focus()
                return
            }

            const refValue = inflectionRef.value
            const grammarRef = (refValue && refValue !== SPECIAL_REF && refValue !== INDECL_REF)
                ? refValue
                : null

            const payload = {
                language: lang,
                lemma,
                pos: posSelect.value,
                // attributes 里放词性声明的字段（语法性 / 自他…）；gender 仍留旧字段做镜像
                attributes: { ...data.attributes },
                gender: normalizeGenders(data.attributes.gender, posSelect.value),
                inflectionType: {
                    label: inflectionLabel.value.trim(),
                    grammarRef
                },
                paradigm: normalizeParadigm(data.paradigm),
                paradigmRoman: normalizeParadigm(data.paradigmRoman),
                stems: collectStems(),
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

function field(label, control, hint, lang = null) {
    return h('label', { class: 'field' },
        h('span', { class: 'field__label' }, label),
        control,
        hint ? h('span', { class: 'field__hint' }, bdiText(hint, lang)) : null
    )
}

function sourceSelect(value, onChange) {
    return h('select', {
        class: 'select',
        onchange: (e) => onChange(e.target.value)
    }, ...WORD_SOURCE_OPTIONS.map((o) => h('option', {
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

