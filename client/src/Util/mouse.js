//import _ from 'lodash';
import c from '../config/CONFIG.json';
import { bit_toggle, parse_bits } from './index.js';

/*var drag_cursors = {
    'tempo': 'ns-resize',
    'inst': 'default',
    'measure': 'ew-resize',
    'beat': 'text'
};
*/

var cursors = {
    'tempo': (__) => 'ns-resize',
    'inst': (__) => 'default',
    'measure': (mods) => 
        mods.shift ? 'ew-resize' : 'default',
    'beat': (mods) =>
        mods.ctrl ? (mods.shift ? 'text' : 'pointer') : 'default'
};

export default (p, Window) => {
    class _Mouse {
        constructor() {
            this.grabbed = 0;
            this.drag = {
                x: 0, y: 0,
                mode: '',
            };
            this.outside_origin = true;
            this.rollover = {};
            this._rollover = {};
            this.cursor = 'default';
            this.translate = [];
        }

        select() {
            let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);
            if (inst >= Window.insts)
                this.outside_origin = true
            else {
                this.outside_origin = Window.select({
                    ind: this.rollover.ind,
                    inst: inst,
                    meas: this.rollover.meas,
                });
                /*if (!_.isEqual(newSelect, Window.selected)) {
                    Window.selected = newSelect;
                    this.outside_origin = true;
                }*/
            };
            console.log(this.outside_origin);
        };

        checkOrigin = (p) => {
            // return if outside canvas or over active menu
            if (p.mouseX === Infinity 
                || p.mouseX < 0
                || p.mouseY === Infinity 
                || p.mouseY < 0
                || p.mouseY > p.height
            ) {
                return true;
            }

            let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);
            // check for editor menus
            if (Window.mode === 2 && Window.selected.meas) {
                let selStart = c.PANES_WIDTH + Window.selected.meas.offset*Window.scale + Window.viewport;
                let menuStart = inst*c.INST_HEIGHT + c.PLAYBACK_HEIGHT;
                if (p.mouseY > menuStart
                    && p.mouseY < menuStart + c.LOCK_HEIGHT
                    && p.mouseX > selStart
                    && p.mouseX < selStart + Window.selected.meas.ms*Window.scale
                )
                    return true;
            }
            return false;
        };

        tickMode() {
            let measure = Window.selected.meas;
            Window.initialize_temp();
            this.grabbed = this.rollover.beat === measure.beats.length - 1 ?
                60000.0/measure.beats.slice(-1)[0]
                : 60000.0/(measure.ticks[(this.rollover.beat * Window.CONSTANTS.PPQ)]);
            Window.selected.dir = (measure.end > measure.start) ?
                1 : ((measure.start > measure.end) ?
                    -1 : 0);
            this.drag.mode = 'tick';
            this.drag.grab = this.rollover.beat;
        }

        measureMode() {
            Window.initialize_temp();
            this.drag.mode = 'measure';
        }

        beatLock(locked) {
            if (!(Window.selected.meas.id in locked))
                locked[Window.selected.meas.id] = {
                    beats: [],
                    meta: {}
                };
            // IS THIS DUMB?
            if (parse_bits(locked[Window.selected.meas.id].beats).length < 2 || parse_bits(locked[Window.selected.meas.id].beats).indexOf(this.rollover.beat) !== -1)
                locked[Window.selected.meas.id].beats = bit_toggle(locked[Window.selected.meas.id].beats, this.rollover.beat);
        }

        clickTempo() {
            this.drag.mode = 'tempo';
            Window.initialize_temp();
            this.drag.grab = this.rollover.beat;
            this.grabbed = this.rollover.beat;
        }

        rolloverCheck(coords, meta) {
            // a four-number array checks within a box,
            // a two-number array checks a point within tolerances

            let tolerance = 0;
            if (coords.length === 2) {
                coords.push(coords[0]);
                coords.push(coords[1]);
                tolerance = 5;
            }

            let xCheck = () =>
                (coords[0] === null) ? true :
                    (p.mouseX >= this.loc.x + coords[0] - tolerance &&
                    p.mouseX < this.loc.x + coords[2] + tolerance);

            let yCheck = () => 
                (coords[1] === null) ? true :
                    (p.mouseY >= this.loc.y + coords[1] - tolerance &&
                    p.mouseY < this.loc.y + coords[3] + tolerance); 

            if (xCheck() && yCheck()) {
                Object.assign(this._rollover, meta);
                this.cursor = (meta.meas &&
                    Window.selected.meas &&
                    meta.meas.id === Window.selected.meas.id
                ) ?
                    cursors[meta.type](Window.mods) :
                    'default';
                return true;
            }
            return false;
        }

        dragCursorUpdate() {
            if (this.drag.mode === 'measure')
                this.cursor = 'ew-resize'
            else if (this.drag.mode === 'tempo')
                this.cursor = 'ns-resize'
            else if (this.drag.mode === 'tick')
                this.cursor = 'text';
        }


        updateRollover() {
            this.rollover = this._rollover;
            this._rollover = {};
        }

        get loc() {
            return this.translate.slice(-1)[0];
        }

        push(t) {
            let last = this.translate.slice(-1)[0];
            if (last)
                this.translate.push({
                    x: last.x + t.x,
                    y: last.y + t.y
                })
            else
                this.translate.push(t);
        }

        pop() {
            return this.translate.pop();
        }

        updatePress() {
            this.drag = { x: 0, y: 0 };
            this.outside_origin = this.checkOrigin(p);
            if (this.outside_origin)
                return true;

            if (this.rollover.type === 'tempo') {
                this.clickTempo();
                return true;
            };
            return false;
        }
    };
    return new _Mouse();
}

