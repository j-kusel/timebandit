var PARAMS = {
    sustain: 50,
    adsr: [50, 200, 0.5, 10],
    lookahead: 25.0, // scheduling buffer frequency in ms
    scheduleAheadTime: 0.1, // scheduling buffer length in seconds
    loop: false
};

var locator = {};

class Clock { 
    constructor(aC, gain, trigger) {
        this.aC = aC;
        this.playing = false;
        this.start = aC.currentTime;
        this.queue = [];
        this.pointer = 0;
        this.tempo = 60;
        this.next_queue = [];
        this.current = 0;

        this.gain = gain;
        this.trigger = trigger;

        ['clear_queue', 'add_events', 'replace_events',
            'run', 'play'].forEach(f =>
                this[f] = this[f].bind(this)
            );
    }

    /*change_tempo(tempo) {
        this.tempo = tempo;
        var ratio = 60 / tempo;
        var events = [1,2,3,4,5,6,7,8,9].map(function(num) {
            return num*ratio;
        });

        this.playing ?
            this.replace_events(events) :
            this.queue = events;
    }*/

    add_events(events) {
        if (!events.length)
            events = [events];
        this.queue = this.queue.concat(events.map(e => e / 1000));
    }

    replace_events(events) {
        if (!events.length)
            events = [events]
        this.next_queue = events;
    }

    clear_queue() {
        this.queue = [];
    }

    run() {
        if (this.pointer >= this.queue.length) {
            this.playing = false;
        }

        locator.current = this.aC.currentTime - this.start;

        // CAN'T CHANGE LOOP ON THE FLY WITH THIS
        if (PARAMS.loop && locator.current >= PARAMS.loop[1]) {
            while (this.pointer > 0 && this.queue[this.pointer] > PARAMS.loop[0])
                this.pointer--;
            let loop_len = PARAMS.loop[1] - PARAMS.loop[0];
            this.start += loop_len;
            locator.current -= loop_len;
            PARAMS.loop_counter++;
        }
        
        if (locator.current >= this.queue[this.pointer]) {
            this.trigger(0);
            if (this.next_queue.length) {
                var self = this;
                this.queue = this.next_queue.map(function(q) { return q+self.current });
                this.next_queue = [];
            }
            this.pointer++;
        }

        if (this.playing)
            setTimeout(this.run, 0);
    }

    play(playBack) {
        this.pointer = 0;

        this.gain.gain.cancelScheduledValues(this.aC.currentTime);
        this.gain.gain.linearRampToValueAtTime(0.0, 0.1);
        if (playBack) {
            this.start = this.aC.currentTime - locator.origin;
            // trim queue according to loop and origin
            while (this.queue.length && this.queue[this.pointer] < locator.origin)
                this.pointer++;

            this.playing = true;
            this.run();
        } else {
            this.playing = false;
            this.queue = [];
        }
    }
}

const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();
var subscriptions = [];
var scheduler_hooks = [];
var trigger_hooks = [];

var insts = {};
const WAVES = ['sine', 'square', 'sawtooth', 'triangle'];

class _AudioInst {
    constructor(id, { type, frequency }) {
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
        this.trigger = (offset) => {
            var ms = PARAMS.adsr.map(function(param) {
                return param/1000.0;
            });
            var timing = offset || aC.currentTime;
            //gain.gain.cancelScheduledValues(aC.currentTime);
            this.gain.gain.setValueAtTime(0.0, timing);
            this.gain.gain.linearRampToValueAtTime(0.7, timing += 0.005);
            this.gain.gain.linearRampToValueAtTime(0.0, timing + 0.015);
        }
        this.clock = new Clock(aC, this.gain, this.trigger);

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



var playback = (isPlaying, score, tracking, audioIds, loop) => {

    if (isPlaying) {
        locator = {
            current: tracking,
            origin: tracking/1000.0,
            start: aC.currentTime
        };
        if (aC.state === 'suspended')
            aC.resume();
        if (loop && tracking <= loop[1]) {
            PARAMS.loop = loop.map(l => l / 1000);
            PARAMS.loop_counter = 0;
        } else
            PARAMS.loop = false;
        tracking = tracking || 0;
        let queues = audioIds.map(__ => []);
        var search = (node) => {
            if (!node)
                return;
            search(node.left);
            node.meas.forEach(meas => {
                var id = audioIds[meas.inst];
                let inst = insts[id];
                queues[meas.inst].push(node.loc);
                inst.clock.add_events(node.loc);
            })
            search(node.right);
        }    
        search(score);

        Object.keys(insts).forEach(key => insts[key].clock.play(true));
    } else
        Object.keys(insts).forEach(inst =>
            insts[inst].clock.clear_queue()
        );
}

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
        /*let seconds = aC.currentTime - locator.start + locator.origin;
        let ms = seconds * 1000.0;
        if (PARAMS.loop && PARAMS.loop_counter)
            seconds -= PARAMS.loop_counter * (PARAMS.loop[1]-PARAMS.loop[0]);
            */
        return locator.current*1000; //seconds * 1000.0;
    },
    WAVES
}


export default audio;
