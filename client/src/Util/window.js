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

    select(newSelected) {
        if (this.selected.meas) {
            if (this.selected.meas.id === newSelected.meas.id)
                return false;
            this.editMeas = {};
            delete this.selected.meas.temp;
        }
        Object.assign(this.selected, newSelected);
    }
        
}

