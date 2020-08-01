import c from '../config/CONFIG.json';
import { primary, secondary } from '../config/CONFIG.json';
import { SHIFT, ALT, SPACE, DEL, BACK, ESC, CTRL, MOD } from './keycodes.js';
import { KeyC, KeyI, KeyV, KeyH, KeyJ, KeyK, KeyL, KeyZ } from './keycodes.js';
import { NUM } from './keycodes.js';


export default (p, Window, Mouse) => {

    let defaults = () => ([
        //
        Window.selected.meas ?
            `Window.selected - start: ${Window.selected.meas.start.toFixed(2)}, end: ${Window.selected.meas.end.toFixed(2)}, ms: ${Window.selected.meas.ms.toFixed(2)}` :
            `Window.selected - none`,
        //
        (Window.selected.meas && 'temp' in Window.selected.meas) ?
            `temp - start: ${Window.selected.meas.temp.start.toFixed(2)}, end: ${Window.selected.meas.temp.end.toFixed(2)}, ms: ${Window.selected.meas.temp.ms.toFixed(2)}` :
            `temp - none`,
        //
        `rollover - type: ${Mouse.rollover.type}, inst: ${Mouse.rollover.inst}, meas: ${'meas' in Mouse.rollover ? Mouse.rollover.meas.id : undefined}, index: ${Mouse.rollover.beat}`,
        //
        `drag - mode: ${Mouse.drag.mode}`,
        //
        (Window.selected.meas) ?
            [`Window.selected: ${'temp' in Window.selected.meas ? [Window.selected.meas.temp.start, Window.selected.meas.temp.end].join(' ') : 'no temp'}  beats - ${Window.selected.meas.ms.toFixed(1)} ms`] :
            ['']
    ]);

    class _Debugger {
        constructor() {
            this.lines = [];
            this.defaults = [];
        }

        frameRate() {
            p.textAlign(p.RIGHT, p.TOP);
            p.textSize(18);
            p.stroke(primary);
            p.fill(primary);
            p.text(`${Math.round(p.frameRate())}fps`, p.width - 10, 5);
        }

        push(line) {
            if (Array.isArray(line))
                line.forEach(l => this.lines.push(l))
            else
                this.lines.push(line);
        }

        write(coords, fontSize) {
            let font = fontSize || c.FONT_DEFAULT_SIZE;
            let lineY = (y) => font*y + coords.y;

            p.stroke(primary); //200, 240, 200);
            p.textSize(c.DEBUG_TEXT);
            p.textAlign(p.LEFT, p.TOP);

            this.push(defaults());
            this.lines.forEach((line, i) => p.text(line, coords.x, lineY(i)));

            p.textAlign(p.CENTER, p.CENTER);
            p.push();
            p.translate(0, lineY(this.lines.length) + 5);
            p.fill(240);
            p.textSize(8);
            [
                {name: 'MOD', code: MOD},
                {name: 'SHIFT', code: SHIFT},
                {name: 'CTRL', code: CTRL},
                {name: 'ALT', code: ALT},
                {name: 'C', code: KeyC},
                {name: 'V', code: KeyV},
            ].forEach((key, ind) => {
                if (p.keyIsDown(key.code))
                    p.fill(120);
                p.rect(5 + ind*25, 0, 20, 15);
                p.fill(240);
                p.text(key.name, 15 + ind*25, 7);
            });

            p.push();
            p.translate(0, 20);
            NUM.forEach((num, ind) => {
                if (p.keyIsDown(num))
                    p.fill(120);
                p.rect(5 + ind*25, 0, 20, 15);
                p.fill(240);
                p.text(ind, 15 + ind*25, 7);
            });
            p.pop();
            p.pop();
        }
        
        clear() {
            this.lines = [];
        }
    }
    return new _Debugger();
};