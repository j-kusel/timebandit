const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();
var locator = {};
var subscriptions = [];
var scheduler_hooks = [];
var trigger_hooks = [];

/*navigator.requestMIDIAccess()
    .then((midiAccess) => console.log(midiAccess.inputs));
    */

var gains = [];
for (let i=0; i < 5; i++) {
    let gain = aC.createGain();
    gain.gain.setValueAtTime(0.0, aC.currentTime);
    gains.push(gain);
};

var oscs = [440, 220, 110].map((freq, ind) => {
    let osc = aC.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, aC.currentTime);

    console.log(gains[ind]);
    osc.connect(gains[ind]);
    osc.start();
    return osc;
});

    
gains.forEach(gain => gain.connect(aC.destination));

var PARAMS = {
    sustain: 50,
    adsr: [50, 200, 0.5, 10],
    lookahead: 25.0, // scheduling buffer frequency in ms
    scheduleAheadTime: 0.1, // scheduling buffer length in seconds
};

var timerIDs = [];

var trigger = (event, params) => {
    let ms = params.map(param => param/1000.0);
    for (let i=0; i<event.inst.length; i++) {
        let timing = aC.currentTime + event.time / 1000.0;
        let osc = event.inst[i];
        //trigger_hooks.forEach(hook => setTimeout(hook(osc), event.time));
        gains[osc].gain.setValueAtTime(0.0, timing);
        gains[osc].gain.linearRampToValueAtTime(0.7, timing + ms[0]);
        gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1]);
        gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1] + PARAMS.sustain);
        gains[osc].gain.linearRampToValueAtTime(0.0, timing + ms[0] + ms[1] + PARAMS.sustain + ms[3]);
    };
    return setTimeout(() => trigger_hooks.forEach(hook => hook(event.inst)), event.time);
};


// time handled in seconds
function scheduler(start, node) {
    let b_start = aC.currentTime*1000 - start;
    let b_end = b_start + PARAMS.scheduleAheadTime * 1000.0;
    let candidates = [];

    let search = (n) => {
        if (n === undefined)
            return;
        let next = [];
        if (n.loc > b_start && n.loc < b_end) {
            candidates.push({ time: n.loc - b_start, inst: n.meas.map(m => m.inst) });
            next.push(n.left);
            next.push(n.right);
        } else if (n.loc > b_end)
            next.push(n.left)
        else if (n.loc < b_start)
            next.push(n.right);
        next.forEach(nx => search(nx));
    }

    search(node);
        
    timerIDs.forEach(id => clearTimeout(id));
    timerIDs = [];
    candidates.forEach((cand) => {
        timerIDs.push(trigger(cand, PARAMS.adsr));
        scheduler_hooks.forEach(hook => hook(cand));
    });

    let new_id = window.setTimeout(() => {
        scheduler(start, node);
    }, PARAMS.lookahead);
    timerIDs.push(new_id);
};

var playback = (isPlaying, score, tracking) => {
    tracking = tracking || 0;
    if (isPlaying) {
        locator = {
            origin: tracking/1000.0,
            start: aC.currentTime
        };
        if (aC.state === 'suspended')
            aC.resume();
        //score.map((inst, ind) => scheduler(aC.currentTime - (tracking/1000.0), ind, inst[1].map(x => x*0.001)));
        scheduler(aC.currentTime*1000 - tracking, score);
    } else {
        timerIDs.forEach(ID => window.clearTimeout(ID));
        gains.forEach(gain => {
            gain.gain.cancelScheduledValues(aC.currentTime);
            gain.gain.linearRampToValueAtTime(gain.gain.value, aC.currentTime);
            gain.gain.linearRampToValueAtTime(0.0, aC.currentTime + 0.05);
        });
    }
};

var audio = {
    init: () => aC.resume().then(() => console.log('resumed')),
    play: playback, //compile(score), //score.forEach((inst, ind) =>
        //inst[1].forEach((beat) => trigger(ind, beat, adsr))),
    kill: () => playback(false),
    set: (param, val) => {
        PARAMS[param] = val;
    },
    subscribe: (func) => subscriptions.push(func),
    triggerHook: (func) => trigger_hooks.push(func),
    schedulerHook: (func) => scheduler_hooks.push(func),
    context: aC,
    locator: () => (aC.currentTime - locator.start + locator.origin)*1000.0
}


export default audio;
