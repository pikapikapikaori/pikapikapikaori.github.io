# 序文

## ツールまたはプロジェクト


以下は、私が開発したいくつかのツールまたはプロジェクトです：

- [docsify-gitalk-with-footer](https://github.com/pikapikapikaori/docsify-gitalk-with-footer)：docsify の gitalk を強化するプラグイン。
- [docsify-enhanced-word-count](https://github.com/pikapikapikaori/docsify-enhanced-word-count)：docsify の単語カウントと i18n ローカリゼーションをサポートするプラグイン。
- [docsify-simple-dark-mode](https://github.com/pikapikapikaori/docsify-simple-dark-mode)：docsify にダークモードを追加するプラグイン。

## おもちゃのインタプリタインタプリタ

### Brainfuck の概要

`Brainfuck` はチューリング完全であり、以下の 8 個の実行可能な命令から成る：

| 命令  |                            意味                            |
| :---: | :--------------------------------------------------------: |
|   >   |               ポインタをインクリメントする。               |
|   <   |                ポインタをデクリメントする。                |
|   +   |           ポインタが指す値をインクリメントする。           |
|   -   |            ポインタが指す値をデクリメントする。            |
|   ,   |  入力から1バイト読み込んで、ポインタが指す先に代入する。   |
|   .   |             ポインタが指す値を出力に書き出す。             |
|   [   | ポインタが指す値が 0 なら、対応する ] の直後にジャンプする。 |
|   ]   | ポインタが指す値が 0 でないなら、対応する [ にジャンプする。 |

### Brainfuck のインタプリタインタプリタ

<div style="max-width: 800px;margin: 0 auto 0;">
    <iframe height="400px" src="jp/archive/ITtech/_media/README/terminal.html"></iframe>
</div>
