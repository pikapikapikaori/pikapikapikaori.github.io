# Beginning

## Some Tools or Projects

Below is some tools or projects I developed:

- [docsify-gitalk-with-footer](https://github.com/pikapikapikaori/docsify-gitalk-with-footer): A plugin to enhance gitalk for docsify.
- [docsify-enhanced-word-count](https://github.com/pikapikapikaori/docsify-enhanced-word-count): A plugin that supports word count and i18n localization for docsify.
- [docsify-simple-dark-mode](https://github.com/pikapikapikaori/docsify-simple-dark-mode): A plugin to add dark mode for docsify.

## A Toy Interpreter

### A Quick Look on Brainfuck

`Brainfuck` consists of only eight simple commands while being a Turing complete language, and the meanings of these eight commands are as follows:

| Command |                                                                                      Meaning                                                                                      |
| :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|    >    |                                                                        Increment the data pointer by one.                                                                         |
|    <    |                                                                        Decrement the data pointer by one.                                                                         |
|    +    |                                                                  Increment the byte at the data pointer by one.                                                                   |
|    -    |                                                                  Decrement the byte at the data pointer by one.                                                                   |
|    ,    |                                                   Accept one byte of input, storing its value in the byte at the data pointer.                                                    |
|    .    |                                                                       Output the byte at the data pointer.                                                                        |
|    [    | If the byte at the data pointer is zero, then instead of moving the instruction pointer forward to the next command, jump it forward to the command after the matching ] command. |
|    ]    | If the byte at the data pointer is nonzero, then instead of moving the instruction pointer forward to the next command, jump it back to the command after the matching [ command. |

### Brainfuck Interpreter

<div style="max-width: 800px;margin: 0 auto 0;">
    <iframe height="400px" src="en-us/archive/ITtech/_media/README/terminal.html"></iframe>
</div>
