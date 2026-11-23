/* global Terminal, brainfuck */

let term = new Terminal({
    rendererType: 'canvas',
    cursorBlink: true,
    theme: {
        foreground: '#c6a2eb',
        background: '#F3F5F6',
        cursor: '#7c3aed',
    }
})

term.open(document.getElementById('terminal'))
let terminalTitleTemplate = 'Hello from \x1B[1;3;35mPikapikapi Blog\x1B[0m $ '
term.prompt = () => {
    term.write(`${terminalTitleTemplate}`)
}

term.write('\r\n')
term.write('\r\n')
term.write('                          \x1B[36mWelcome to Pikapikapi Blog!')
term.write('\r\n')
term.write(' This terminal is a minimal brainfuck interpreter, you can try doing like this:\x1B[0m')
term.write('\r\n')
term.write('\r\n')
term.write('           \x1B[32mbrainfuck <brainfuck code> [your input for brainfuck code]\x1B[0m')
term.write('\r\n')
term.write('\r\n')
term.write('                            \x1B[36mAnd here is an example:\x1B[0m')
term.write('\r\n')

term.write('\r\n')
term.prompt()

let currentLine = ''
let historyLines = []
let currentLineIndex = 0
let currentArrowIndex = 0

let replaceLineWithContent = function (content, oldContent) {
    term.write('\x1b[2K\r')
    let rowNum = parseInt((oldContent.length + 28) / 80)
    if (rowNum > 0) {
        for (let i = rowNum; i > 0; i--) {
            term.write('\x1b[2K\r')
            term.write('\x1b[A\r')
        }
    }
    term.write('\x1b[2K\r')
    term.prompt()
    term.write(content)
}

let judgeInput = function (input) {
    let inputContents = input.split(' ')
    switch (inputContents[0]) {
        case 'brainfuck':
            if (inputContents.length === 3 || inputContents.length === 2) {
                let output
                if (inputContents.length === 2) {
                    inputContents.push('')
                }

                if (new RegExp('^[,.<>+-\\[\\]\s]+$').test(inputContents[1])) {
                    output = brainfuck(inputContents[1], inputContents[2] + String.fromCharCode(255))
                }
                else {
                    output = ''
                }

                if (output.length === 0) {
                    output = '\x1B[1;3;35mPikapikapi Blog\x1B[0m: Syntax Error'
                }
                term.write('\r\n')
                term.write(output)
            }
            else {
                term.write('\r\n')
                term.write('\x1B[1;3;35mPikapikapi Blog\x1B[0m: Command not found: ' + input)
            }
            break
        default:
            term.write('\r\n')
            term.write('\x1B[1;3;35mPikapikapi Blog\x1B[0m: Command not found: ' + input)
    }
}

term.onKey((key) => {
    const ev = key.domEvent
    switch (ev.keyCode) {
        case 13:
            if (currentLine.length > 0) {
                historyLines.push(currentLine)
                judgeInput(currentLine)
                currentLine = ''
                currentLineIndex = historyLines.length
                currentArrowIndex = 0
                term.write('\r\n')
                term.prompt()
            }
            break
        case 8:
            if (currentLine.length > 0 && currentArrowIndex > 0) {
                let previousLine = currentLine
                currentLine = currentLine.substring(0, currentArrowIndex - 1) + currentLine.substring(currentArrowIndex, currentLine.length)
                replaceLineWithContent(currentLine, previousLine)
                for (let i = currentLine.length; i >= currentArrowIndex; i--) {
                    term.write('\x1b[D')
                }
                currentArrowIndex--
            }
            break
        case 37:
            if (currentArrowIndex > 0 && currentArrowIndex <= currentLine.length) {
                term.write('\x1b[D')
                currentArrowIndex--
            }
            break
        case 39:
            if (currentArrowIndex >= 0 && currentArrowIndex < currentLine.length) {
                term.write('\x1b[C')
                currentArrowIndex++
            }
            break
        case 38:
            if (currentLineIndex > 0 && currentLineIndex <= historyLines.length) {
                let previousLine = currentLine
                currentLine = historyLines[currentLineIndex - 1]
                currentLineIndex--
                replaceLineWithContent(currentLine, previousLine)
                currentArrowIndex = currentLine.length
            }
            break
        case 40:
            if (currentLineIndex >= 0 && currentLineIndex < historyLines.length - 1) {
                let previousLine = currentLine
                currentLine = historyLines[currentLineIndex + 1]
                currentLineIndex++
                replaceLineWithContent(currentLine, previousLine)
                currentArrowIndex = currentLine.length
            }
            else if (currentLineIndex === historyLines.length - 1) {
                let previousLine = currentLine
                currentLine = ''
                currentLineIndex++
                replaceLineWithContent(currentLine, previousLine)
                currentArrowIndex = currentLine.length
            }
            break
        default:
            let previousLine = currentLine
            if (currentArrowIndex < currentLine.length) {
                currentLine = currentLine.substring(0, currentArrowIndex) + key.key + currentLine.substring(currentArrowIndex, currentLine.length)
            }
            else {
                currentLine += key.key
            }
            currentArrowIndex++
            replaceLineWithContent(currentLine, previousLine)
            for (let i = currentLine.length; i > currentArrowIndex; i--) {
                term.write('\x1b[D')
            }
    }
})

term.write('brainfuck +[--->++<]>+.++[->++++<]>+.+++++++.---------.++++++++++++.--.--------.--[--->+<]>-.---[->++++<]>.-----.[--->+<]>-----.[-->+++++<]>.--[--->++++<]>+.++.----------.-[++>-----<]>.-------.++.----------.-[++>-----<]>.-------.[--->+<]>---.+[->++<]>.-[--->+<]>+.+++.--------.-[--->+<]>-.')
term.write('\r\n')
term.write('Welcome to Pikapikapi Blog!')
term.write('\r\n')
term.prompt()
historyLines.push('brainfuck +[--->++<]>+.++[->++++<]>+.+++++++.---------.++++++++++++.--.--------.--[--->+<]>-.---[->++++<]>.-----.[--->+<]>-----.[-->+++++<]>.--[--->++++<]>+.++.----------.-[++>-----<]>.-------.++.----------.-[++>-----<]>.-------.[--->+<]>---.+[->++<]>.-[--->+<]>+.+++.--------.-[--->+<]>-.')
currentLineIndex++
