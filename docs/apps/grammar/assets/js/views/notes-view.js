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

        if (!lines.length || lines.every((line) => !String(line).trim())) editor.focusFirst()

        const onBlankDoubleClick = (e) => {
            const target = e.target instanceof Element ? e.target : null
            if (!target) return
            if (target.closest('.note-row, .note-bar, .page-head, .page-breadcrumbs, button, a, input, textarea, select, label')) return
            editor.focusLast()
        }
        main.addEventListener('dblclick', onBlankDoubleClick)

        const onHide = () => editor.flushSave()
        window.addEventListener('pagehide', onHide)

        return () => {
            main.removeEventListener('dblclick', onBlankDoubleClick)
            window.removeEventListener('pagehide', onHide)
            editor.flushSave()
            editor.destroy()
        }
    }
}
