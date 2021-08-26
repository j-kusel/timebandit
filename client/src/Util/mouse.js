//import _ from 'lodash';
import c from '../config/CONFIG.json';
import { bit_toggle, parse_bits } from './index.js';
import _ from 'lodash';

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
            this.rollover = { type: '' };
            this._rollover = {};
            this.lock_type = null;
            this.cursor = 'default';
        }

        checkLock() {
            if (p.mouseX > p.mouseDown.x - 17 &&
                p.mouseX < p.mouseDown.x + 18 &&
                p.mouseY > p.mouseDown.y - 20 &&
                p.mouseY < p.mouseDown.y + 0
            ) {
                this.lock_type = 'both'
            } else if (p.mouseY > p.mouseDown.y - 10 &&
                p.mouseY < p.mouseDown.y + 10
            ) {
                if (p.mouseX < p.mouseDown.x - 10 &&
                    p.mouseX > p.mouseDown.x - 45
                ) {
                    this.lock_type = 'loc'
                }
                else if (p.mouseX < p.mouseDown.x + 45 &&
                    p.mouseX > p.mouseDown.x + 10
                ) {
                    this.lock_type = 'tempo';
                }
            }
        }

        canceller(bool, cause) {
            this.cancel = bool;
            if (bool)
                console.log('Click cancelled' + (cause ? `: ${cause}` : '.'));
        }

        pressInit(p, checks) {
            // basic resets
            this.resetDrag();
            p.mouseDown = { x: p.mouseX, y: p.mouseY };

            // run all interruption checks and assign bool for cancellation
            this.canceller(checks.some(check => {
                let failed = check.func();
                console.log(`${check.name}: ${failed}`);
                return failed;
            }), 'pressInit');
        }

        resetDrag() {
            Object.assign(this.drag, { x: 0, y: 0, mode: '' });
        }

        select(type) {
            // NEEDS TO INCLUDE SCROLL
            let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);

            if (inst >= Window.insts)
                this.canceller(true, 'Selecting outside of instruments range (Mouse.select)')
            else {
                let new_select = { inst };

                // type specification overrides standard selection checking.
                // even a successful check returns false.
                if (type && type === 'inst') {
                    Window.select(new_select);
                    this.canceller(false);
                    return false;
                }

                new_select.meas = this.rollover.meas;

                if (type && type === 'beat')
                    new_select.beat = this.rollover.beat;

                // cancel the rest of the mousePressed event if a selection is successful
                this.canceller(Window.select(new_select), 'Selection was successful.');
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
                this.canceller(true, 'Mouse clicked outside of canvas.');
                return true;
            }

            let inst = Math.floor((p.mouseY-c.PLAYBACK_HEIGHT)/c.INST_HEIGHT);
            // check for editor menus
            /*if (Window.mode === 2 && Window.selected.meas) {
                let selStart = c.PANES_WIDTH + Window.selected.meas.offset*Window.scale + Window.viewport;
                let menuStart = (inst+1)*c.INST_HEIGHT + c.PLAYBACK_HEIGHT;

                if (p.mouseY > menuStart
                    && p.mouseY < menuStart + c.LOCK_HEIGHT
                    && p.mouseX < selStart
                    && p.mouseX > selStart + Window.selected.meas.ms*Window.scale
                ) {
                    this.canceller(true, 'Mouse clicked over editor menu');
                    return true;
                }
            }*/
            this.canceller(false);
            return false;
        };

        tickMode() {
            let measure = this.rollover.meas;
            Window.initialize_temp(measure);
            let divisor = measure.denom/4;
            this.grabbed = this.rollover.beat === measure.beats.length - 1 ?
                60000.0/measure.beats.slice(-1)[0]
                : 60000.0/(measure.ticks[(this.rollover.beat * Window.CONSTANTS.PPQ / divisor)]);
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
            if (!(Window.editor.type && ('temp' in Window.editor.meas)))
                Window.initialize_temp(this.rollover.meas);
            this.drag.mode = 'measure';
        }

        pollMode() {
            this.drag.mode = 'modulation';
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
            console.log('locking');
            if (Window.locking(this.rollover.meas, this.rollover.beat))
                this.drag.mode = 'lock';
        }

        checkTempo() {
            if (!this.rollover.meas)
                return false;
            this.drag.mode = 'tempo';
            Window.initialize_temp(this.rollover.meas);
            this.drag.grab = this.rollover.beat;
            this.grabbed = this.rollover.beat;
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
            if (Window.selected.meas) {
                // if selected measure is in rollover
                if ('meas' in this.rollover && Window.getSelection().indexOf(this.rollover.meas.id) > -1) {
                    if (Window.mods.mod && (this.rollover.type === 'beat')) {
                        this.cursor = (Window.mods.shift) ? 'text' : 'pointer';
                    } else if (Window.mods.shift && this.rollover.type === 'measure')
                        this.cursor = 'ew-resize';
                }
            }
            // if rolling over an editor option
            if (this.rollover.type && this.rollover.type.indexOf('marking') > -1)
                this.cursor = 'text';

            document.body.style.cursor = this.cursor;
        }

        buttonCheck(buttons) {
            if (buttons.some(click => click())) {
                // what's the point of clearing buttons here?
                buttons = [];
                this.canceller(true, 'Button pressed.');
                return true;
            }
            return false;
        }
    };
    return new _Mouse();
}

