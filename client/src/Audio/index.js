const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();


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

var trigger = (osc, time, params) => {
    let ms = params.map(param => param/1000.0);
    let timing = aC.currentTime + time;
    gains[osc].gain.setValueAtTime(0.0, timing);
    gains[osc].gain.linearRampToValueAtTime(0.7, timing + ms[0]);
    gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1]);
    gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1] + PARAMS.sustain);
    gains[osc].gain.linearRampToValueAtTime(0.0, timing + ms[0] + ms[1] + PARAMS.sustain + ms[3]);
};


var timerIDs = [];
function scheduler(start, target, beats) {
    let done = true;
    let candidates = 
        beats
            .map(beat => {
                let total = beat + start;
                if (total > aC.currentTime)
                    done = false;
                return total;
            })
            .filter(loc => {
                return (loc > aC.currentTime && loc < aC.currentTime + PARAMS.scheduleAheadTime)
            });

    if (done)
        return;
    let scheduled = [];
    while (candidates.length) {
         scheduled.push(trigger(target, candidates.pop() - aC.currentTime, PARAMS.adsr));
    };
    let new_id = window.setTimeout(() => {
        scheduler(start, target, beats);
        //scheduled.forEach((id) => window.clearTimeout(id));
    }, PARAMS.lookahead);
    timerIDs.push(new_id);
};

var playback = (isPlaying, score, tracking) => {
    let start = aC.currentTime + tracking;
    if (isPlaying) {
        if (aC.state === 'suspended')
            aC.resume();
        score.map((inst, ind) => scheduler(start, ind, inst[1].map(x => x*0.001)));
    } else
        timerIDs.forEach(ID => window.clearTimeout(ID));
};




// USE THIS IF INDEPENDENT SCHEDULERS AREN'T EFFECTIVE
var compile = (score) => {
    let pointers = score.map(() => 0);
    console.log(pointers);
    let ordered = [];
    // wait for all pointers to expire
    let current = score.reduce((acc, inst, i) => [...acc, inst[1][0]], []);
    let lowest = current.reduce((acc, val, ind) => (val < acc.val) ? { val, ind } : acc, { val: Infinity });
    while (current.reduce((acc, val, i) => val || acc, false)) {
        if (lowest.val)
            ordered.push(lowest);
        pointers[lowest.ind]++;
        let pointer = pointers[lowest.ind];
        let inst = score[lowest.ind];
        current[lowest.ind] = (pointer === inst[1].length) ?
            null : score[lowest.ind][1][pointer];
        lowest = current.reduce((acc, val, ind) => (val < acc.val) ? { val, ind } : acc, { val: Infinity });
    };
    console.log(ordered);
    return ordered;
};


var audio = {
    init: () => aC.resume().then(() => console.log('resumed')),
    play: (score) => playback(true, score, 0),//compile(score), //score.forEach((inst, ind) =>
        //inst[1].forEach((beat) => trigger(ind, beat, adsr))),
    kill: () => //gains.forEach((gain) => gain.setValueAtTime(0.0, aC.currentTime))
        timerIDs.forEach(ID => {
            window.clearTimeout(ID);
        }),
    set: (param, val) => {
        PARAMS[param] = val;
    }
}


export default audio;
