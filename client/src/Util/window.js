import c from '../config/CONFIG.json';
import { primary, secondary, secondary_light } from '../config/CONFIG.json';

export default class _Window {
    constructor() {
        this.scale = 1.0;
        this.viewport = 0;
        this.span = [Infinity, -Infinity];

        // modes: ESC, INS, EDITOR
        this.mode = 0;
        this.panels = false;
        this.selected = {
            inst: -1,
            meas: undefined
        };
        this.insts = 0;

        this.insertMeas = {};
        this.editMeas = {};

    }

    initialize_temp() {
        this.selected.meas.temp = {
            start: this.selected.meas.start,
            end: this.selected.meas.end,
            ms: this.selected.meas.ms,
            ticks: this.selected.meas.ticks,
            beats: this.selected.meas.beats,
            offset: this.selected.meas.offset
        };
    }

    updateView(event, p, { zoom }) {
        if (zoom) {
            let change = 1.0-event.delta/c.SCROLL_SENSITIVITY;
            this.scale *= change;
            this.viewport = p.mouseX - change*(p.mouseX - this.viewport);
        };
        this.viewport -= event.deltaX;
    }

    select(newSelected) {
        if (this.selected.meas) {
            if (this.selected.meas.id === newSelected.meas.id)
                return false;
            this.editMeas = {};
            delete this.selected.meas.temp;
        }
        Object.assign(this.selected, newSelected);
    }
 
    drawFrame(p) {
        // DRAW BACKGROUND
        p.stroke(secondary_light);
        p.fill(secondary_light);
        p.rect(0, 0, p.width, p.height);
       
        // DRAW TOP BAR
        p.stroke(secondary);
        p.fill(secondary);
        p.rect(0, 0, p.width, c.PLAYBACK_HEIGHT);

        // DRAW BOTTOM BAR
        p.stroke(secondary);
        p.fill(secondary);
        p.rect(0, p.height - c.TRACKING_HEIGHT, p.width, c.TRACKING_HEIGHT);
    }

    drawTabs(p, { locator, cursor_loc, isPlaying }) {
        
        p.push();
        // draw tabs
        p.stroke(primary);
        p.fill(primary);

        p.translate(0, p.height - c.TRACKING_HEIGHT);
        p.rect(0, 0, p.width, c.TRACKING_HEIGHT);
        // left
        
        // LOCATION
        // left    

        p.push();
        p.stroke(secondary);
        p.fill(secondary);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(10);
        p.text(isPlaying ? `LOCATION: ${locator}` : `CURSOR: ${cursor_loc}`,
            c.TRACKING_PADDING.X, c.TRACKING_PADDING.Y);
        // right
        p.textAlign(p.RIGHT, p.TOP);
        let _span = this.span.map(s => s.toFixed(2)); // format decimal places
        let len = _span[1]-_span[0];
        p.text(`${_span[0]} - ${_span[1]}, \u2248 ${Math.floor(len/60000.0)}'${Math.floor(len/1000.0) % 60}"`, p.width - c.TOOLBAR_WIDTH - c.TRACKING_PADDING.X, c.TRACKING_PADDING.Y);
        p.pop();

        p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, 0);
        p.textSize(8);
        p.textAlign(p.LEFT, p.CENTER);
        p.stroke(secondary);
        p.fill(secondary);

        p.line(0, 0, 0, c.TRACKING_HEIGHT);
        p.line(c.INSERT_WIDTH, 0, c.INSERT_WIDTH, c.TRACKING_HEIGHT);
        p.translate(c.INSERT_PADDING, 0);
        p.text('- INSERT', 0, c.TRACKING_HEIGHT/2);
        p.text('- EDITOR', c.INSERT_WIDTH, c.TRACKING_HEIGHT/2);
        p.pop();
    }


    _scaleY(input, height, range) {
        return height - (input - range.tempo[0])/(range.tempo[1] - range.tempo[0])*height;
    }
       
    drawToolbar(p, tempoRange) { 
        p.push();
        p.stroke(primary);
        p.fill(primary);

        p.translate((p.width - c.TOOLBAR_WIDTH) / 3.0, p.height - c.TRACKING_HEIGHT - c.INSERT_HEIGHT);

        if (this.mode === 1) {
            p.push();
            p.rect(0, 0, c.EDITOR_WIDTH, c.INSERT_HEIGHT);

            p.stroke(secondary);
            p.line(c.INSERT_WIDTH, c.EDITOR_HEIGHT, c.EDITOR_WIDTH, c.EDITOR_HEIGHT); 

            if ('beats' in this.insertMeas) {
                p.stroke(secondary);
                p.fill(secondary);

                // draw beats
                // push into padding
                p.push();
                p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                this.insertMeas.beats.forEach((beat) => {
                    let x = (beat/this.insertMeas.ms)*last;
                    p.line(x, 0, x, c.PREVIEW_HEIGHT);
                });
                // draw tempo
                let ystart = this._scaleY(this.insertMeas.start, c.PREVIEW_HEIGHT, tempoRange);
                let yend = this._scaleY(this.insertMeas.end, c.PREVIEW_HEIGHT, tempoRange);
                p.line(0, ystart, last, yend);

                // push into metadata
                p.push();
                p.translate(0, c.PREVIEW_HEIGHT + c.INSERT_PADDING);
                p.textAlign(p.LEFT, p.TOP);
                /*let lines = [
                    `${this.insertMeas.start} - ${this.insertMeas.end} / ${this.insertMeas.timesig}`,
                    `${this.insertMeas.ms.toFixed(2)}ms`
                ];
                blockText(lines, { x: 0, y: 0 }, 6); 
                */
                p.pop();
                p.pop();
            }
            p.pop();
        };

        if (this.mode === 2) {
            p.rect(0, 0, c.EDITOR_WIDTH, c.EDITOR_HEIGHT);
            p.stroke(secondary);
            p.line(0, c.EDITOR_HEIGHT, c.INSERT_WIDTH, c.EDITOR_HEIGHT); 
            if (this.selected.meas) {
                // push into padding
                p.push();
                p.stroke(secondary);
                p.translate(c.INSERT_PADDING, c.INSERT_PADDING);
                let last = c.EDITOR_WIDTH - c.INSERT_PADDING*2;
                let meas = this.selected.meas;
                meas.beats.forEach((beat) => {
                    let x = (beat/meas.ms)*last;
                    p.line(x, 0, x, c.PREVIEW_HEIGHT);
                });
                // draw tempo
                let ystart = this._scaleY(meas.start, c.PREVIEW_HEIGHT, tempoRange);
                let yend = this._scaleY(meas.end, c.PREVIEW_HEIGHT, tempoRange);
                p.line(0, ystart, last, yend);
                p.pop();
            }
        }
        p.pop();
    }

    drawEditorFrame(p, coords, handle) {
        p.push();
        let opac = p.color(primary);
        opac.setAlpha(180);
        p.stroke(opac);
        p.fill(opac);
        p.translate(...coords);
        if (handle)
            p.ellipse(...handle);

        let PANES_THIN = c.PANES_WIDTH/4;
        let inc = 180.0 / c.INST_HEIGHT;
        let op = p.color(primary)
        let end = this.selected.meas.ms*this.scale;
        for (let i=0; i <= c.INST_HEIGHT; i++) {
            op.setAlpha(i*inc);
            p.stroke(op);
            p.line(-PANES_THIN, i, 0, i);
            p.line(end, i, end + PANES_THIN, i);
        }
        p.translate(0, c.INST_HEIGHT);
        p.rect(-PANES_THIN, 0, PANES_THIN*2 + this.selected.meas.ms*this.scale, c.LOCK_HEIGHT);

        p.stroke(secondary);
        p.fill(secondary);
        p.textSize(10);
        p.textAlign(p.LEFT, p.CENTER);
        //p.text(`${select.start} -> ${select.end} / ${select.timesig}`, 5, c.PANES_WIDTH);
            
        p.pop();
    }


}

