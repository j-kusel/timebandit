import uuidv4 from 'uuid';

var p = {};

class Printer {
    constructor(processing) {
        p = processing;

        this.paper_dim = "11x8.5";
        this.dpi = 72;
        this.margins = 5;
        this.duration = 10000;
        this.frames = {};
        this.pages = {};
       
    }

    push(range) {
        this.frames[uuidv4()] = range;
    }

    snapshot(instruments, center, options) {
        // copy class defaults and override with options argument
        let paper_dim, dpi, margins, duration;
        let these = Object.assign({}, this);
        ({ paper_dim, dpi, margins, duration } = Object.assign(these, options));

        let w, h;
        [w, h] = paper_dim.split('x').map(dim => parseInt(dim, 10)*dpi);
        let _margins = [w, h].map(dim => dim * margins * 0.01);
        let img = p.createImage(w, h);
        let ratio = (w * (1 - margins*0.02))/duration;
        img.loadPixels();
        let inst_height = h/instruments.length;
        let spread = [center-duration*0.5, center+duration*0.5];
        instruments.forEach((inst, ind) => {
            Object.keys(inst.measures).forEach(key => {
                let meas = inst.measures[key];
                meas.beats.forEach((beat, i) => {
                    let loc = meas.offset + beat;
                    if (loc < spread[1] &&
                        loc > spread[0]
                    ) {
                        for (let y=0; y<inst_height; y++) {
                            img.set(Math.round((loc-spread[0])*ratio) + _margins[0],
                                y+ind*inst_height,
                                (i===0) ? p.color(100, 0, 255) : p.color(255, 0, 100)
                            );
                        }
                    }
                });
            });
        });

        img.updatePixels();
        let id = uuidv4();
        this.pages[id] = {
            center,
            spread,
            img
        };
        return img;
    }

    clear(target) {
        if (target) {
            delete this.frames[target];
            return;
        }
        this.frames = {};
        this.pages = {};
    }
};


export default Printer; /*(p, Window) => {
    const _x_to_ms = x => (x-Window.viewport)/Window.scale;

    const defaults = { 
        paper_dim: "11x8.5",
        dpi: 72,
        margins: 5,
        duration: 10000
    };

    const snap = (instruments, center, options) => {
        let paper_dim, dpi, margins, duration;
        ({ paper_dim, dpi, margins, duration } = Object.assign(defaults, options));

        let w, h;
        [w, h] = paper_dim.split('x').map(dim => parseInt(dim, 10)*dpi);
        let _margins = [w, h].map(dim => dim * margins * 0.01);
        let img = p.createImage(w, h);
        let ratio = (w * (1 - margins*0.02))/duration;
        img.loadPixels();
        let inst_height = h/instruments.length;
        let click_window = [center-duration*0.5, center+duration*0.5];
        instruments.forEach((inst, ind) => {
            Object.keys(inst.measures).forEach(key => {
                let meas = inst.measures[key];
                meas.beats.forEach((beat, i) => {
                    let loc = meas.offset + beat;
                    if (loc < click_window[1] &&
                        loc > click_window[0]
                    ) {
                        for (let y=0; y<inst_height; y++) {
                            img.set(Math.round((loc-click_window[0])*ratio) + _margins[0],
                                y+ind*inst_height,
                                (i===0) ? p.color(100, 0, 255) : p.color(255, 0, 100)
                            );
                        }
                    }
                });
            });
        });

        img.updatePixels();
        return img;
    }

    return ({ snap, });
}*/
