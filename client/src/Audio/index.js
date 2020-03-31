const AudioContext = window.AudioContext || window.webkitAudioContext;

const aC = new AudioContext();


var gains = [];
for (let i=0; i < 5; i++) {
    let gain = aC.createGain();
    gain.gain.setValueAtTime(0.0, aC.currentTime);
    gains.push(gain);
    console.log(gains);
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

var sustain = 50;
var adsr = [2, 200, 0.5, 10];

var trigger = (osc, time, params) => {
    let timing = aC.currentTime + time/1000.0;
    let ms = params.map(param => param/1000.0);
    console.log(osc);

    gains[osc].gain.setValueAtTime(0.0, timing);
    gains[osc].gain.linearRampToValueAtTime(1.0, timing + ms[0]);
    gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1]);
    gains[osc].gain.linearRampToValueAtTime(ms[2], timing + ms[0] + ms[1] + sustain);
    gains[osc].gain.linearRampToValueAtTime(0.0, timing + ms[0] + ms[1] + sustain + ms[3]);
};

var audio = {
    play: (score) => score.forEach((inst, ind) =>
        inst[1].forEach((beat) => trigger(ind, beat, adsr))),
    kill: () => gains.forEach((gain) => gain.setValueAtTime(0.0, aC.currentTime))
}
            
            
export default audio;
