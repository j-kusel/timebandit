const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();
var locator = {};
var subscriptions = [];
var scheduler_hooks = [];
var trigger_hooks = [];

var insts = {};
const WAVES = ['sine', 'square', 'sawtooth', 'triangle'];

class _AudioInst {
    constructor(id, { type, frequency }) {
        console.log(type, frequency);
        this.id = id;

        [this.gain, this.volume, this.mute] = [ 1, 2, 3 ].map(__ => aC.createGain());
        this.osc = aC.createOscillator();

        this.gain.gain.setValueAtTime(0.0, aC.currentTime);
        this.volume.gain.setValueAtTime(0.8, aC.currentTime);
        this.mute.gain.setValueAtTime(1.0, aC.currentTime);

        if (!type)
            type = 'sine';
        if (!frequency)
            frequency = 440;
        this.osc.type = type;
        this.osc.frequency.setValueAtTime(frequency, aC.currentTime);

        this.osc.connect(this.gain);
        this.gain.connect(this.mute);
        this.mute.connect(this.volume);
        this.volume.connect(aC.destination);
        
        // maybe wait to start on playback?
        this.osc.start();
    };

    type(wave) {
        if (wave) {
            if (WAVES.indexOf(wave) >= 0) {
                this.osc.type = wave;
            } else {
                console.log('Invalid argument for oscillator type:', wave);
                return false;
            }
        }
        return this.osc.type;
    }

    frequency(freq) {
        if (freq) {
            if (typeof(freq) === 'number') {
                this.osc.frequency.setValueAtTime(freq, aC.currentTime);
            } else {
                console.log('Invalid argument for oscillator frequency:', freq);
                return false;
            }
        }
        return this.osc.frequency.value;
    }

    delete() {
        ['gain', 'mute', 'volume'].forEach(gain => this[gain].disconnect());
        this.osc.stop();
        delete insts[this.id];
    }

}

const newInst = (id, options) => {
    console.log('creating new Inst ', id);
    insts[id] = new _AudioInst(id, options);
};

const deleteInst = (id) => {
    if (id in insts) {
        delete insts[id];
        return true;
    }
    console.log('Instrument ID not found, nothing deleted.');
    return false;
}

const setVolume = (id, vol) => {
    if (vol < 0.0 || vol > 1.0) {
        console.log('Volume must be a float between 0.0 - 1.0.');
        return false;
    };
    insts[id].volume.gain.setValueAtTime(vol, aC.currentTime);
    return true;
}

const getType = (id) => {
    return insts[id].type();
};

const setType = (id, type) => {
    return insts[id].type(type);
};


const getFrequency = (id) => {
    return insts[id].frequency();
}

const setFrequency = (id, freq) => {
    return insts[id].frequency(freq);
};



/*var oscs = [];
[440, 220, 110].forEach((freq, ind) => {
    let osc = aC.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, aC.currentTime);

    osc.connect(gains[ind]);
    gains[ind].connect(mutes[ind]);
    mutes[ind].connect(volumes[ind]);
    osc.start();
    oscs.push(osc);
});

volumes.forEach(vol => vol.connect(aC.destination));
*/

var PARAMS = {
    sustain: 50,
    adsr: [50, 200, 0.5, 10],
    lookahead: 25.0, // scheduling buffer frequency in ms
    scheduleAheadTime: 0.1, // scheduling buffer length in seconds
    loop: false
};

var timerIDs = [];

var trigger = (event, params) => {
    let ms = params.map(param => param/1000.0);
    for (let i=0; i<event.inst.length; i++) {
        let timing = aC.currentTime + event.time / 1000.0;
        let gain = insts[event.inst[i]];
        //trigger_hooks.forEach(hook => setTimeout(hook(osc), event.time));
        gain.gain.gain.setValueAtTime(0.0, timing);
        gain.gain.gain.linearRampToValueAtTime(0.7, timing + ms[0]);
        gain.gain.gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1]);
        gain.gain.gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1] + PARAMS.sustain);
        gain.gain.gain.linearRampToValueAtTime(0.0, timing + ms[0] + ms[1] + PARAMS.sustain + ms[3]);
    };
    return setTimeout(() => trigger_hooks.forEach(hook => hook(event.inst)), event.time);
};


// time handled in seconds
function scheduler(start, node, audioIds) {
    // if looping is active, "shift" start time
    // by the length of the loop

    // schedule upcoming buffer
    let b_start = aC.currentTime*1000 - start;
    let b_end = b_start + PARAMS.scheduleAheadTime * 1000.0;
    let new_start, new_end;
    let excess;
    if (PARAMS.loop) {
        let loop = PARAMS.loop[1] - PARAMS.loop[0];
        if (b_start > PARAMS.loop[1]) {
            start += loop;
            b_start -= loop;
            b_end -= loop;
            PARAMS.loop_counter++;
        } else if (b_end > PARAMS.loop[1]) {
            // how long until we reach the loop end? 
            excess = b_end - PARAMS.loop[1];
            b_end -= excess;
            new_start = b_start - (loop);
            new_end = new_start +PARAMS.scheduleAheadTime * 1000.0;
        }
    }

    let candidates = [];

    let s_start, s_end;
    [s_start, s_end] = [b_start, b_end];

    let search = (n) => {
        if (n === undefined)
            return;
        let next = [];
        if (n.loc > s_start && n.loc < s_end) {
            candidates.push({ time: n.loc - s_start, inst: n.meas.map(m => audioIds[m.inst]) });
            next.push(n.left);
            next.push(n.right);
        } else if (n.loc > s_end)
            next.push(n.left)
        else if (n.loc < s_start)
            next.push(n.right);
        next.forEach(nx => search(nx));
    }

    // search through once for remaining buffer
    search(node);
    if (PARAMS.loop && excess) {
        // update starts and search again at loop beginning
        s_start = new_start;
        s_end = new_end;
        search(node);
    }
        
    timerIDs.forEach(id => clearTimeout(id));
    timerIDs = [];
    candidates.forEach((cand) => {
        timerIDs.push(trigger(cand, PARAMS.adsr));
        scheduler_hooks.forEach(hook => hook(cand));
    });

    let new_id = window.setTimeout(() => {
        scheduler(start, node, audioIds);
    }, PARAMS.lookahead);
    timerIDs.push(new_id);
};

var playback = (isPlaying, score, tracking, audioIds, loop) => {
    tracking = tracking || 0;
    if (isPlaying) {
        locator = {
            origin: tracking/1000.0,
            start: aC.currentTime
        };
        console.log(locator);
        if (aC.state === 'suspended')
            aC.resume();
        if (loop && tracking <= loop[1]) {
            PARAMS.loop = loop;
            PARAMS.loop_counter = 0;
        } else
            PARAMS.loop = false;
        //score.map((inst, ind) => scheduler(aC.currentTime - (tracking/1000.0), ind, inst[1].map(x => x*0.001)));
        scheduler(aC.currentTime*1000 - tracking, score, audioIds);
    } else {
        timerIDs.forEach(ID => window.clearTimeout(ID));
        Object.keys(insts).forEach(inst => {
            let gain = insts[inst].gain;
            gain.gain.cancelScheduledValues(aC.currentTime);
            gain.gain.linearRampToValueAtTime(gain.gain.value, aC.currentTime);
            gain.gain.linearRampToValueAtTime(0.0, aC.currentTime + 0.05);
        });
    }
};

/*var setVolume = (target, vol) => {
    volumes[target].gain.cancelScheduledValues(aC.currentTime);
    volumes[target].gain.linearRampToValueAtTime(vol, aC.currentTime + 0.1);
}*/

var loop = (range) => {
    if (!range)
        return PARAMS.loop = false;
    PARAMS.loop = range;
};

var mute = (target, bool) => {
    insts[target].mute.gain.cancelScheduledValues(aC.currentTime);
    insts[target].mute.gain.linearRampToValueAtTime(bool ? 0.0 : 1.0, aC.currentTime + 0.05);
}

var solo = (target, bool) => {
    Object.keys(insts).forEach((key, i) => {
        let inst = insts[key];
        let vol = bool ? 
            (key === target ? 1.0 : 0.0) :
            1.0; 
        inst.mute.gain.cancelScheduledValues(aC.currentTime);
        inst.mute.gain.linearRampToValueAtTime(vol, aC.currentTime + 0.05);
    });
}

var audio = {
    init: () => aC.resume().then(() => console.log('resumed')),
    newInst,
    deleteInst,
    play: playback, //compile(score), //score.forEach((inst, ind) =>
        //inst[1].forEach((beat) => trigger(ind, beat, adsr))),
    kill: () => playback(false),
    setVolume,
    getType,
    setType,
    getFrequency,
    setFrequency,
    loop,
    mute,
    solo,
    set: (param, val) => {
        PARAMS[param] = val;
    },
    subscribe: (func) => subscriptions.push(func),
    triggerHook: (func) => trigger_hooks.push(func),
    schedulerHook: (func) => scheduler_hooks.push(func),
    context: aC,
    locator: () => {
        let seconds = aC.currentTime - locator.start + locator.origin;
        let ms = seconds * 1000.0;
        if (PARAMS.loop && PARAMS.loop_counter)
            ms -= PARAMS.loop_counter * (PARAMS.loop.[1]-PARAMS.loop.[0]);
        return ms;
    },
    WAVES
}


export default audio;
