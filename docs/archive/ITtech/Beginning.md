# 前言

## 一些小工具或项目

下面是我开发的一些小工具或项目：

- [docsify-gitalk-with-footer](https://github.com/pikapikapikaori/docsify-gitalk-with-footer)：用于 docsify 的一款插件，修复了原生添加 gitalk 时的一些问题。
- [docsify-enhanced-word-count](https://github.com/pikapikapikaori/docsify-enhanced-word-count)：用于 docsify 的一款插件，为 docsify 添加字数统计，且支持 i18n 国际化。
- [docsify-simple-dark-mode](https://github.com/pikapikapikaori/docsify-simple-dark-mode)：用于 docsify 的一款插件，为 dcosify 增加黑暗模式。

## 一个玩具解释器

### Brainfuck 语言简介

`Brainfuck` 语言仅含有 8 种有效字符，是一个图灵完备的语言。其 8 种字符的含义如下：

| 字符  |                     含义                     |
| :---: | :------------------------------------------: |
|   >   |                   指针加一                   |
|   <   |                   指针减一                   |
|   +   |               指针指向的值加一               |
|   -   |               指针指向的值减一               |
|   ,   |            输入内容到指针指向的值            |
|   .   |               输出指针指向的值               |
|   [   |  如果指针指向的值为 0，则直接跳转到对应的 ] 处  |
|   ]   | 如果指针指向的值不为 0，则直接跳转到对应的 [ 处 |

### Brainfuck 解释器

<div style="max-width: 800px;margin: 0 auto 0;">
    <iframe height="400px" src="archive/ITtech/_media/README/terminal.html"></iframe>
</div>
