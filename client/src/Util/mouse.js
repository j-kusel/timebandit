//import _ from 'lodash';
import c from '../config/CONFIG.json';
import { lt, lte } from './index';
import { colors } from 'bandit-lib';
import pointer from './../static/pointers/pointer.svg';
import text from './../static/pointers/text.svg';
import ew_resize from './../static/pointers/ew-resize.svg';
import def from './../static/pointers/default.svg';

let loadCursors = { pointer, text, 'ew-resize': ew_resize, def };

/*var drag_cursors = {
    'tempo': 'ns-resize',
    'inst': 'default',
    'measure': 'ew-resize',
    'beat': 'text'
};
*/

var DRAG_DEFAULT = { x: 0, y: 0, mode: '' };
var MOVE_DEFAULT = { x: 0, y: 0, mode: '' };



export default (p, Window) => {
    class _Mouse {
        constructor() {
            this.grabbed = 0;
            this.drag = Object.assign({}, DRAG_DEFAULT);
            this.move = Object.assign({}, MOVE_DEFAULT);
            this.cancel = true;
            this.rollover = { type: '' };
            this._rollover = {};
            this.lock_type = null;
            this.cursor = 'def';
            this.press = 0;

            this.cursors = { 'def': {}, 'ew-resize': {}, 
                'pointer': {}, 'text': {} };
            let icon_dims = {
                'def': [0, 0, 20, 20, 7, 3],
                'ew-resize': [-8, -8, 20, 20, 0, 0],
                'pointer': [-6, 0, 20, 20, 0, 0],
                'text': [-8, -11, 20, 20, 2, 2]
            };

            Object.keys(this.cursors).forEach(icon =>
                p.loadImage(loadCursors[icon], img => {
                    console.log(img);
                    this.cursors[icon].icon = img;
                    this.cursors[icon].draw = () => 
                        p.image(img, ...icon_dims[icon]);
                })
            );
        }

        draw() {
            p.push();
            p.translate(p.mouseX, p.mouseY);
            if (this.press) {
                let col = p.color(colors.primary);
                if (this.press <= 10)
                    col.setAlpha(255/10*this.press);
                p.both(col);
                p.circle(0, 0, 16-(this.press--));
            }
            if (this.cursors[this.cursor].draw)
                this.cursors[this.cursor].draw();

            p.pop();
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

        // might need to separate this later but it works for now
        resetDrag() {
            this.drag = Object.assign({}, DRAG_DEFAULT);
            /*delete this.drag.filter_drag;
            delete this.move.filter_move;
            Object.assign(this.drag, { x: 0, y: 0, mode: '' });
            Object.assign(this.drag, { x: 0, y: 0, mode: '' });
            */
        }

        resetMove() {
            this.move = Object.assign({}, MOVE_DEFAULT);
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

        markerMode() {
            this.drag.mode = 'marker';
            Window.press_marker();
        }

        loopMode() {
            this.drag.mode = 'loop';
        }

        pasteMode(breaks) {
            this.move.type = 'paste';
            this.move.center = (breaks.span[1] - breaks.span[0]) * 0.5;
            // search takes mouse drag and breaks
            let search_l = (x, b) => {
                if (!b)
                    return [x];
                if (x > b.center_far && x < b.center_near)
                    return [x, b.center_far, b.center_near];
                // which side does it snap to?
                if (b.next && x > b.next.center_near)
                    return [(x < (b.next.center_near+b.center_far)*0.5) ?
                        b.next.center_near : b.center_far,
                        b];
                // otherwise keep searching
                return search_l(x, b.next);
            };

            this.move.filter_move = () => {
                let move = Window.x_to_ms(p.mouseX - c.PANES_WIDTH);
                if (move < breaks.span[0] - breaks.left[0].wiggle + breaks.center_half) {
                    let left = search_l(move, breaks.left[0]);
                    this.move.origin = Window.ms_to_x(left[0]);
                    this.move.origin_ms = left[0];
                } else {
                    this.move.origin = Window.ms_to_x(move);
                    this.move.origin_ms = move;
                }
            }

        }

        tickMode() {
            let measure = this.rollover.meas;
            Window.initialize_temp(measure);
            let divisor = measure.denom/4;
            this.grabbed = this.rollover.beat === measure.beats.length - 1 ?
                60000.0/measure.beats.slice(-1)[0]
                : 60000.0/(measure.ticks[(this.rollover.beat * Window.CONSTANTS.PPQ / divisor)]);
            // DIR SHOULD BE OBSOLETE
            /*Window.selected.dir = (measure.end > measure.start) ?
                1 : ((measure.start > measure.end) ?
                    -1 : 0);
                    */
            this.drag.mode = 'tick';
            this.drag.grab = this.rollover.beat;
        }

        menuMode(name) {
            this.drag.mode = 'menu';
            Window.toggle_menu(name);
        }

        entryMode() {
            this.drag.mode = 'entry';
            Window.press_event(this.rollover);
        }

        printMode() {
            this.drag.mode = 'printer';
        }

        measureMode({ breaks }) {
            if (!(Window.editor.type && ('temp' in Window.editor.meas)))
                Window.getSelection().forEach(id =>
                    Window.initialize_temp(Window.selected[id]));
            if (breaks) {
                // search takes mouse drag and breaks
                let search = (drag, b) => {
                    if (drag > b.bias && drag < b.wiggle)
                        return [drag, b.bias, b.wiggle];
                    // which side does it snap to?
                    if (b.next && drag < b.next.bias)
                        return [(drag > (b.next.bias+b.wiggle)*0.5) ?
                            b.next.bias : b.wiggle,
                            null, null];
                    // otherwise keep searching
                    return search(drag, b.next);
                };

                this.drag.filter_drag = (drag) => {
                    if (drag < 0) {
                        let left = search(-drag, breaks.left[0]);
                        if (left[0]) left[0] *= -1;
                        return left;
                    }
                    return search(drag, breaks.right[0]);
                }
            } else
                this.drag.filter_drag = (d) => [d, -Infinity, Infinity];
            
            this.drag.mode = 'measure';
        }

        pollMode() {
            this.drag.mode = 'modulation';
        }

        beatLock() {
            console.log('locking');
            if (Window.locking(this.rollover.meas, this.rollover.beat))
                this.drag.mode = 'lock';
        }

        tempoMode() {
            /*if (!this.rollover.meas)
                return false;
                */
            this.drag.mode = 'tempo';
            Window.initialize_temp(this.rollover.meas);
            this.drag.grab = this.rollover.beat;
            this.grabbed = this.rollover.beat;
        }

        rolloverLoop() {
            if (p.mouseY < c.PLAYBACK_HEIGHT+6) {
                let mouseX = p.mouseX - c.PANES_WIDTH - Window.viewport;
                if (mouseX > Window.loop.cache.start-6 && mouseX < Window.loop.cache.end+6) {
                    let rollover = { type: 'loop' };
                    if (mouseX < Window.loop.cache.start + 6)
                        rollover.side = 'start'
                    else if (mouseX > Window.loop.cache.end - 6)
                        rollover.side = 'end';
                    this.setRollover(rollover);
                    this.eval_cursor();
                    return true;
                }
            }
            return false;
        }

        rolloverMarker(markers) {
            if (p.mouseY < c.PLAYBACK_HEIGHT+6) {
                let mouseX = p.mouseX - c.PANES_WIDTH - Window.viewport;
                let rollover = {};
                // loop rollover
                rollover.type = 'marker';
                Object.keys(Window.markers).some(key => {
                    let marker = Window.markers[key]; 
                    let cache = marker.cache;
                    let end = (cache.end || cache.start);
                    if (mouseX > cache.start-20 && mouseX < end+20) {
                        rollover.marker = marker;
                        //console.log(p.mouseY < 8 && p.mouseY > 2);
                        //console.log((mouseX > end + 12) && (mouseX < end + 18));
                        if ((p.mouseY < 10) &&
                            (p.mouseY > 2) &&
                            (mouseX > end - 10) &&
                            (mouseX < end - 2)
                        )
                            rollover.X = true;
                        return true;
                    }
                    return false;
                });
                this.setRollover(rollover);
                this.eval_cursor();
                return true;
            }
        }

        rolloverInstruments(instruments) {
            let y_loc = p.mouseY - c.PLAYBACK_HEIGHT + Window.scroll;
            let frameY = y_loc % c.INST_HEIGHT;
            let inst = Math.floor(y_loc/c.INST_HEIGHT);

            let rollover = { inst };
            // translating to viewport
            let X = p.mouseX - c.PANES_WIDTH;
            let frameX = X - Window.viewport;
            if (inst < instruments.length && inst >= 0) {
                let instrument = instruments[inst];
                // check for inst name rollover
                p.push();
                p.textSize(12);
                let nameWidth = p.textWidth(instrument.name);
                p.pop();
                if ((frameY >= c.INST_HEIGHT - 20) &&
                    (X <= nameWidth + 10) &&
                    (frameY <= c.INST_HEIGHT - 12) &&
                    (X >= 10)
                )
                    rollover.type = 'instName_marking';
                else // check for measure rollover
                    rollover = this.rolloverMeasures(rollover, instrument, frameX, frameY);
                this.setRollover(rollover);
                this.eval_cursor();
                return true;
            }
        }

        rolloverMarkings(rollover, frameX, frameY) {
            let meas = rollover.meas;
            if (['start_tempo_marking', 'end_tempo_marking', 'timesig_marking'].some((type, ind) => {
                let bounds = meas.cache.bounding[ind];
                return (frameX > bounds[0] && frameX < bounds[2] && 
                    frameY > bounds[1] && frameY < bounds[3]
                ) ?
                    (rollover.type = type) : false;
            }))
                return rollover;
            return false;
        }

        rolloverGraph(rollover, frameX, frameY, graph) {
            let meas = rollover.meas;
            let ind = rollover.beat;
            let beat = meas.cache.beats[ind];
            if (frameX > graph[0] && frameX < graph[2]) {
                let y = graph[1] - (frameX-beat)*meas.cache.graph_ratios[ind];
                if (frameY > y - c.ROLLOVER_TOLERANCE &&
                    frameY < y + c.ROLLOVER_TOLERANCE
                ) {
                    rollover.type = 'tempo';
                    if ((Window.editor.type === 'start' || Window.editor.type === 'end') && Window.editor.meas.id !== meas.id) {
                        let spread = meas.cache.beats[ind + 1] - beat;
                        let perc = (frameX - beat)/spread;
                        let PPQ_adjust = Window.CONSTANTS.PPQ / (meas.denom / 4);
                        let tick = Math.round(perc * PPQ_adjust) + ind*PPQ_adjust;
                        // should the user be able to select the tempo graph of the edited measure?
                        let tempo = (tick * (meas.end - meas.start) / meas.ticks.length) + meas.start;
                        Window.editor_hover(tempo);
                        Object.assign(rollover, { tick, tempo });
                    }
                    return rollover;
                }
            }
            return false;
        }

        rolloverBeats(rollover, frameX, frameY) {
            let meas = rollover.meas;
            let beats = meas.cache.beats;
            for (let i=0; i<beats.length; i++) {
                let beat = beats[i];
                if ((frameX > beat - c.ROLLOVER_TOLERANCE) &&
                    (frameX < beat + c.ROLLOVER_TOLERANCE)
                ) {
                    let tempo = (meas.end - meas.start)/meas.timesig * i + meas.start;
                    if ((Window.editor.type === 'start' || Window.editor.type === 'end')
                        && Window.editor.meas.id !== meas.id
                    )
                        Window.editor_hover(tempo);
                    return Object.assign(rollover, { type: 'beat', beat: i, tempo });
                } else if (i < meas.cache.beats.length-1) { // last beat has no graph
                    let graph_ro = this.rolloverGraph(rollover, frameX, frameY, meas.cache.graph[i]);
                    if (graph_ro)
                        return (graph_ro);
                }
            };
        }

        rolloverEvents(rollover, frameX) {
            let meas = rollover.meas;
            for (let i=0; i<meas.events.length; i++) {
                let event = meas.events[i];
                if ((frameX > event.cache.ms_start - c.ROLLOVER_TOLERANCE) &&
                    (frameX < event.cache.ms_start + c.ROLLOVER_TOLERANCE)
                ) 
                    return Object.assign(rollover, { type: 'event', event });
            }
            return false;
        }
        
        rolloverSchemas(rollover, frameX, frameY) {
            // add schemas to rollover
            let schema_info = {
                schema_pos: 'right',
                schemaX: false
            }
            let schema = false;
            let meas = rollover.meas;
            if (meas.schemaIds.length) {
                let search = (s) => {
                    let schema = s;
                    if (frameX < s.cache.ms_start || frameX > s.cache.ms_end)
                        return false;
                    if (s.schemas)
                        s.schemaIds.some(id => 
                            schema = search(s.schemas[id]));
                    return schema || s;
                }
                meas.schemaIds.some(id => schema = search(meas.schemas[id]));
                // check for X hover
                if (schema) {
                    rollover.schema = schema;
                    let cache = schema.cache;
                    let y_check = frameY > 4 && frameY < 12;
                    if (schema.beat_end >= meas.timesig) {
                        schema_info.schema_pos = 'left';
                        if (y_check && frameX > cache.ms_start + 4 &&
                            frameX < cache.ms_start + 12
                        )
                            schema_info.schemaX = true;
                    } else if (y_check && frameX > cache.ms_end - 12 &&
                        frameX < cache.ms_end - 4
                    )
                        schema_info.schemaX = true;
                    rollover.schema_info = schema_info;
                }
            }
            return rollover;
        }

        rolloverMeasures(rollover, instrument, frameX, frameY) {
            rollover.type = 'measure';
            instrument.ordered.some(meas => {
                if ((frameX > meas.cache.offset)
                    && (frameX < meas.cache.offset + meas.cache.ms)
                ) {
                    rollover.meas = meas;
                    // translating to measure
                    let frameXmeas = frameX - meas.cache.offset;
                    if (Window.entry.mode)
                        return (rollover = this.rolloverEntry(rollover, frameXmeas));
                    // check markings and bypass
                    let marking_ro = this.rolloverMarkings(rollover, frameXmeas, frameY);
                    if (marking_ro)
                        return (rollover = marking_ro);

                    // check schemas
                    rollover = this.rolloverSchemas(rollover, frameXmeas, frameY);

                    // check events and bypass
                    let event_ro = this.rolloverEvents(rollover, frameXmeas);
                    if (event_ro)
                        return (rollover = event_ro)

                    // check beats
                    let beat_ro = this.rolloverBeats(rollover, frameXmeas, frameY);
                    if (beat_ro)
                        return (rollover = beat_ro);
                }
                return false;
            });
            return rollover;
        }

        rolloverEntry(rollover, frameX) {
            let meas = rollover.meas;
            let note = Math.pow(2, Window.entry.duration);
            let snaps = [];
            let ids;
            if (!meas.cache.snaps)
                meas.cache.snaps = {}
            if (!(note in meas.cache.snaps)) {
                let basis = Math.max(note, meas.denom);
                let inc = meas.denom / basis;
                ids = {};
                let count = 0;
                let PPB = Window.CONSTANTS.PPQ*(4/meas.denom);
                for (let i=0; i<meas.timesig; i+=inc) {
                    snaps.push(i);
                    let basis_ratio = basis / note;
                    let meta = ids[i] = {
                        schema: false, beat: [count+1, basis].join('/'),
                        beat_start: i, beat_dur: inc * basis_ratio,
                    }
                    meta.nominal = [note + ': ' + meta.beat];
                    meta.tick_start = meta.beat_start * PPB;
                    meta.tick_dur = meta.beat_dur * PPB;
                    count++;
                }
                if (meas.schemaIds.length) {
                    let search = (schema, snaps) => {
                        let s_snaps = [];
                        let basis = Math.max(schema.basis, note);
                        let ratio = schema.basis / basis;
                        let dur_ratio = basis / note;
                        inc = schema.beat_dur / schema.tuplet[0] * ratio;
                        let count = 0;
                        for (let i=0; lt(i, schema.beat_dur); i+=inc) {
                            let start = i+schema.beat_start;
                            s_snaps.push(start);
                            let meta = ids[start] = {
                                schema, beat: [count+1, basis].join('/'),
                                beat_start: start, beat_dur: inc * dur_ratio,
                            }
                            meta.nominal = [note + ': ' + meta.beat].concat(schema.nominal);
                            meta.tick_start = meta.beat_start * PPB;
                            meta.tick_dur = meta.beat_dur * PPB;
                            count++;
                        }
                        if (schema.schemaIds && schema.schemaIds.length)
                            schema.schemaIds.forEach(id =>
                                search(schema.schemas[id], s_snaps)
                            );
                        let indices = [0,0];
                        snaps.some((s,i) =>
                            lte(schema.beat_start, s) && (indices[0] = i)
                        );
                        snaps.some((s,i) =>
                            lte(schema.beat_end, s) && (indices[1] = i)
                        );
                        snaps.splice(indices[0],indices[1]-indices[0], ...s_snaps);
                    };
                    meas.schemaIds.forEach(id => {
                        let schema = meas.schemas[id];
                        search(schema, snaps);
                    });
                }
                meas.cache.snaps[note] = { snaps, ids };
            }

            ({ snaps, ids } = meas.cache.snaps[note]);

            let tick_perc = 1/meas.cache.ticks.length;
            let perc;
            // default to end
            let frac = meas.timesig;
            let last = 0;
            meas.cache.ticks.slice(1).some((tick,i) => {
                if (tick > frameX) {
                    let remainder = (frameX - last)/(tick-last);
                    perc = (i+remainder)*tick_perc;
                    frac = perc * meas.timesig;
                    return true;
                }
                last = tick;
                return false;
            });
            let beat_start;
            last = 0;
            snaps.some(s => {
                if (frac < s) {
                    let avg = (s + last) * 0.5;
                    beat_start = (frac > avg) ? s : last;
                    return true;
                }
                last = s;
                return false;
            });
            Object.assign(rollover, { type: 'entry', note }); 
            // remove conditional here?
            if (beat_start in ids)
                Object.assign(rollover, ids[beat_start]);
                
            Object.assign(Window.entry, 
                Window.calculate_entry_cache(
                    meas.cache,
                    rollover.tick_start,
                    rollover.tick_dur
            ));

            return rollover;
        }

        setRollover(meta) {
            this.rollover = meta;
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

        eval_cursor() {
            this.cursor = 'def';
            if (this.rollover.type === 'loop' && this.rollover.side)
                this.cursor = 'ew-resize'
            else if (this.rollover.type === 'marker') {
                this.cursor = 'ew-resize';
                if (this.rollover.X)
                    this.cursor = 'pointer';
            }
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

