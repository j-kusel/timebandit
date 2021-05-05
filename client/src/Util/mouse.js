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
    'printerDelete': (__) => 'pointer',
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
            this.cancel = true;
            this.rollover = {};
            this._rollover = {};
            this.cursor = 'default';
        }

        pressInit(p, checks) {
            // basic resets
            this.resetDrag();
            p.mouseDown = { x: p.mouseX, y: p.mouseY };

            // run all interruption checks and assign bool for cancellation
            this.cancel = checks.some(check => check());
        }

        resetDrag() {
            Object.assign(this.drag, { x: 0, y: 0, mode: '' });
        }

        select(type) {
            let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);

            if (inst >= Window.insts)
                this.cancel = true
            else {
                let new_select = { inst };

                // type specification overrides standard selection checking.
                // even a successful check returns false.
                if (type && type === 'inst') {
                    Window.select(new_select);
                    this.cancel = false;
                    return false;
                }

                new_select.meas = this.rollover.meas;

                if (type && type === 'beat')
                    new_select.beat = this.rollover.beat;

                // cancel the rest of the mousePressed event if a selection is successful
                this.cancel = Window.select(new_select);
                return this.cancel;
            };
        };

        checkOrigin = (p) => {
            // return if outside canvas or over active menu
            if (p.mouseX === Infinity 
                || p.mouseX < 0
                || p.mouseY === Infinity 
                || p.mouseY < 0
                || p.mouseY > p.height
            ) {
                this.cancel = true;
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
                    this.cancel = true;
                    return true;
            }
            this.cancel = false;
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

        printMode() {
            this.drag.mode = 'printer';
        }

        measureMode() {
            Window.initialize_temp();
            this.drag.mode = 'measure';
        }

        beatLock() {
            /*if (!(Window.selected.meas.id in locked))
                locked[Window.selected.meas.id] = {
                    beats: [],
                    meta: {}
                };
            // IS THIS DUMB?
            if (parse_bits(locked[Window.selected.meas.id].beats).length < 2 || parse_bits(locked[Window.selected.meas.id].beats).indexOf(this.rollover.beat) !== -1)
                locked[Window.selected.meas.id].beats = bit_toggle(locked[Window.selected.meas.id].beats, this.rollover.beat);
                */
            console.log(this.rollover.beat);
            if (Window.locking(Window.selected.meas, this.rollover.beat))
                this.drag.mode = 'lock';
        }

        checkTempo() {
            if (this.rollover.type === 'tempo') {
                this.drag.mode = 'tempo';
                Window.initialize_temp();
                this.drag.grab = this.rollover.beat;
                this.grabbed = this.rollover.beat;
                return true;
            };
            return false;
        }

        setRollover(meta) {
            this.rollover = meta
        }

        /* DEPRECATED
        rolloverCheck(coords, meta, additional) {
            // a four-number array checks within a box,
            // a two-number array checks a point within tolerances

            if (typeof(additional) !== 'function') {
                additional = () => true;
            }
            let tolerance = 0;
            if (coords.length === 2) {
                coords.push(coords[0]);
                coords.push(coords[1]);
                tolerance = 5;
            }


            let add = additional();
            if (meta.type === 'tempo') {
                p.push();
                p.fill(0);
                //p.rect(coords[0],coords[1],coords[2],coords[3]);
                //p.rect(this.loc.x+coords[0],this.loc.y+coords[1],coords[2]-coords[0],coords[3]-coords[1]);
                p.pop();
            }
            let xCheck = () =>
                (coords[0] === null) ? true :
                    (p.mouseX >= this.loc.x + coords[0] - tolerance &&
                    p.mouseX < this.loc.x + coords[2] + tolerance);

            let yCheck = () => 
                (coords[1] === null) ? true :
                    (p.mouseY >= this.loc.y + coords[1] - tolerance &&
                    p.mouseY < this.loc.y + coords[3] + tolerance); 

            if (xCheck() && yCheck() && add) {
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
        */

        dragCursorUpdate() {
            if (this.drag.mode === 'measure')
                this.cursor = 'ew-resize'
            else if (this.drag.mode === 'tempo')
                this.cursor = 'ns-resize'
            else if (this.drag.mode === 'tick')
                this.cursor = 'text';
        }

        eval_cursor(mods, selected) {
            this.cursor = 'default';
            if (selected) {
                // if selected measure is in rollover
                if ('meas' in this.rollover && this.rollover.meas.id === selected.id) {
                    if (Window.mods.mod && (this.rollover.type === 'beat')) {
                        this.cursor = 'pointer';
                        if (Window.mods.shift)
                            this.cursor = 'text';
                    } else if (Window.mods.shift && this.rollover.type === 'measure')
                        this.cursor = 'ew-resize';
                }
            }
            document.body.style.cursor = this.cursor;
        }

        buttonCheck(buttons) {
            if (buttons.some(click => click())) {
                // what's the point of clearing buttons here?
                buttons = [];
                this.cancel = true;
                return true;
            }
            return false;
        }
    };
    return new _Mouse();
}

