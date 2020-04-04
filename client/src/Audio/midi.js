import MidiWriter from 'midi-writer-js';
//import TempoEvent from 'midi-writer-js/src'; ///track'; //meta-events/tempo-event';
//import {TempoEvent} from 'midi-writer-js/meta-events/tempo-event.js';
//import {Utils} from 'midi-writer-js/utils.js';
//import {Constants} from 'midi-writer-js/constants.js';

// monkey patching TempoEvent/setTempo to allow for delta changes
var numberToVariableLength = (ticks) => {
    var buffer = ticks & 0x7F;

    while (ticks = ticks >> 7) {
                    buffer <<= 8;
                    buffer |= ((ticks & 0x7F) | 0x80);
                }

    var bList = [];
    while (true) {
                    bList.push(buffer & 0xff);

                    if (buffer & 0x80) buffer >>= 8
                    else { break; }
                }

    return bList;
};
var numberToBytes = (number, bytesNeeded) => {
    bytesNeeded = bytesNeeded || 1;
    var hexString = number.toString(16);
    if (hexString.length & 1) { // Make sure hex string is even number of chars
                    hexString = '0' + hexString;
    }
    var hexArray = hexString.match(/.{2}/g);
    hexArray = hexArray.map(item => parseInt(item, 16));
    if (hexArray.length < bytesNeeded) {
         while (bytesNeeded - hexArray.length > 0) {
             hexArray.unshift(0);
         }
    }
    return hexArray;
};

class _TempoEvent {
    constructor(delta, bpm) {
        this.type = 'tempo';
        const tempo = Math.round(60000000 / bpm);
        this.data = numberToVariableLength(delta).concat(
            0xFF,
            0x51,
            [0x03], // Size
            numberToBytes(tempo, 3), // Tempo, 3 bytes
        );
    }
};

//MidiWriter.Track.prototype.setTempo = (delta, bpm) => this.addEvent(new _TempoEvent(delta, bpm));

var track = new MidiWriter.Track();

export default (tracks, beats, PPQ) => {
    MidiWriter.Constants.HEADER_CHUNK_DIVISION = [0x00, PPQ.toString(16)];

    var new_track = [new MidiWriter.Track(), new MidiWriter.Track()];
    // handle initial gap, if any
    let offset = tracks[0].slice(0, 1);
    new_track[0].setTempo(offset[0].tempo);

    
    new_track[0].addEvent(new _TempoEvent(offset[0].delta, offset[0].tempo));
    let delta = 0;
    tracks[0].slice(1).forEach((tick) => {
        new_track[0].addEvent(new _TempoEvent(delta, tick.tempo));
        delta = ('delta' in tick) ?
            tick.delta : 1;
    });
    /*var note = new MidiWriter.NoteEvent({
        pitch: 'C5',
        duration: '4',
    });
    new_track[0].addEvent(note);
    */

    beats[0].forEach((beat) => new_track[1].addEvent(new MidiWriter.NoteEvent(beat)));
    /*new_track[1].addEvent(
        new MidiWriter.NoteEvent({
            wait: 'T2',
            duration: '4',
        })
    );

    for (let i=0; i < 11; i++) {
        new_track[1].addEvent(
            new MidiWriter.NoteEvent({
                duration: '4',
            })
        );
    };
    */

    var write = new MidiWriter.Writer(new_track);
    console.log(write.dataUri());

    var dlLink = document.createElement('a');
    var blob = new Blob([write.buildFile()], {type: "audio/midi"});
    dlLink.href = window.URL.createObjectURL(blob);
    dlLink.download = 'midi.mid';
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
};
