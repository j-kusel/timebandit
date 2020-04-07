const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();

/*navigator.requestMIDIAccess()
    .then((midiAccess) => console.log(midiAccess.inputs));
    */

var muted = [];
var gains = [];
for (let i=0; i < 5; i++) {
    let gain = aC.createGain();
    gain.gain.setValueAtTime(0.0, aC.currentTime);
    gains.push(gain);
    muted.push(false);
};

[440, 220, 110].forEach((freq, ind) => {
    var osc = aC.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, aC.currentTime)
    osc.connect(gains[ind]);
    osc.start();
});

gains.forEach(gain => gain.connect(aC.destination));

var sustain = 50;
var adsr = [2, 200, 0.5, 10];

var trigger = (osc, time, params) => {

    if (muted[osc])
        return;
    let timing = aC.currentTime + time/1000.0;
    let ms = params.map(param => param/1000.0);

    gains[osc].gain.setValueAtTime(0.0, timing)
        .linearRampToValueAtTime(1.0, timing + ms[0])
        .linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1])
        .linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1] + sustain)
        .linearRampToValueAtTime(0.0, timing + ms[0] + ms[1] + sustain + ms[3]);
};

var audio = {
    init: () => aC.resume().then(() => console.log('resumed')),
    mute: (target, mute) => muted[target] = mute,
    play: (score) => score.forEach((inst, ind) =>
        inst[1].forEach((beat) => trigger(ind, beat, adsr))),
    kill: () => gains.forEach((gain) => gain.gain.setValueAtTime(0.0, aC.currentTime))
}
            
            
export default audio;
