/** 笔记页：一门语言一份，一行一块。 */

import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { bdiNode } from '../utils/bdi.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import { getNote, saveNote } from '../store/note-store.js'
import { createNoteEditor } from '../components/note-editor.js'
import { createNoteToolbar } from '../components/note-toolbar.js'
import { toast } from '../components/toast.js'

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

        setBreadcrumbs([
            { label: '语言列表', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: '笔记' }
        ])

        const row = await getNote(userId, lang)

        // 编辑器建好时工具条已经存在，它会在首帧里被要求同步一次状态
        let editor = null

        const saveEl = h('span', {
            class: 'note-toolbar__state',
            role: 'status',
            'aria-live': 'polite'
        })

        const toolbar = createNoteToolbar({
            onCommand: (cmd) => { if (editor) editor.applyCommand(cmd) },
            getState: () => (editor ? editor.getState() : null),
            stateEl: saveEl
        })

        const lines = (row && row.lines) || []
        editor = createNoteEditor({
            lines,
            lang,
            onStateChange: (state) => toolbar.refresh(state),
            onSave: async (lines) => {
                try {
                    await saveNote(userId, lang, lines)
                    toolbar.setSaveState('saved')
                } catch (err) {
                    toolbar.setSaveState('failed')
                    toast.error(`笔记保存失败：${err.message}`, 5000)
                }
            }
        })

        const head = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' },
                    bdiNode(language.native, lang), ' · ', language.name),
                h('div', { class: 'page-head__sub' }, '笔记')
            )
        )

        replace(main,
            h('div', { class: 'notes-page' },
                head,
                h('div', { class: 'note-bar' }, toolbar.el, saveEl),
                editor.el
            )
        )

        // 空笔记（没有行，或只有空行）直接把光标放进第一行
        if (!lines.length || lines.every((line) => !String(line).trim())) editor.focusFirst()

        const onHide = () => editor.flushSave()
        window.addEventListener('pagehide', onHide)

        return () => {
            window.removeEventListener('pagehide', onHide)
            editor.flushSave()
            editor.destroy()
        }
    }
}
