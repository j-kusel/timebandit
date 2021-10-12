import MidiWriter from 'midi-writer-js';
import JSZip from 'jszip';

/*
var MIDI;

window.navigator.requestMIDIAccess().then(access => {
    MIDI = access;
    console.log(MIDI.outputs.values());
});
*/

// monkey patching TempoEvent to allow for delta changes
class _TempoEvent {
    constructor(delta, bpm) {
        this.type = 'tempo';
        const tempo = Math.round(60000000 / bpm);
        this.data = MidiWriter.Utils.numberToVariableLength(delta).concat(
            0xFF,
            0x51,
            [0x03], // Size
            MidiWriter.Utils.numberToBytes(tempo, 3), // Tempo, 3 bytes
        );
    }
};

class _TimeSignatureEvent {
    constructor(numerator, denominator, notespermidiclock, midiclockspertick) {
        this.type = 'time-signature';

        // Start with zero time delta
        this.data = MidiWriter.Utils.numberToVariableLength(0x00).concat(
            0xFF,
            0x58,
            [0x04], // Size
            MidiWriter.Utils.numberToBytes(numerator, 1), // Numerator, 1 bytes
            MidiWriter.Utils.numberToBytes(Math.log2(denominator), 1), // Denominator is expressed as pow of 2, 1 bytes
            MidiWriter.Utils.numberToBytes(midiclockspertick || 24, 1), // MIDI Clocks per tick, 1 bytes
            MidiWriter.Utils.numberToBytes(notespermidiclock || 8, 1), // Number of 1/32 notes per MIDI clocks, 1 bytes
        );
        console.log(this.data);
    };
}

let download = (zip) => {
    var dlLink = document.createElement('a');
    dlLink.download = 'score.zip';

    zip.generateAsync({ type: 'blob' })
        .then((blob) => {
            dlLink.href = window.URL.createObjectURL(blob);
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
        }, (err) => console.log(err));
}

let event_track = (tracks, PPQ, PPQ_tempo) => {
    MidiWriter.Constants.HEADER_CHUNK_DIVISION = [0x00, PPQ];
    var zip = new JSZip();
    var score = zip.folder('score');
    let PPQ_mod = PPQ / PPQ_tempo;

    tracks.forEach((track) => {
        var new_track = [new MidiWriter.Track(), new MidiWriter.Track()];
        // handle initial gap, if any
        let offset = track.tempi.slice(0, 1);
        new_track[0].setTempo(offset[0].tempo);

        let delta = offset[0].delta;
        track.tempi.slice(1).forEach((tick) => {
            new_track[0].addEvent(new _TempoEvent(delta, tick.tempo));
            if ('timesig' in tick)
                new_track[0].addEvent(new _TimeSignatureEvent(tick.timesig, tick.denom, PPQ));
            delta = ('delta' in tick) ?
                tick.delta : PPQ_mod;
        });
       
        console.log(track.beats);
        track.beats.forEach((beat) => new_track[1].addEvent(new MidiWriter.NoteEvent(beat)));
        
        var write = new MidiWriter.Writer(new_track);
        let blob = new Blob([write.buildFile()], {type: "audio/midi"});
        score.file(track.name + '.mid', blob);
    });

    download(zip);
};


let click_track = (tracks, PPQ, PPQ_tempo) => {
    MidiWriter.Constants.HEADER_CHUNK_DIVISION = [0x00, PPQ];
    var zip = new JSZip();
    var score = zip.folder('score');
    let PPQ_mod = PPQ / PPQ_tempo;

    tracks.forEach((track) => {
        var new_track = [new MidiWriter.Track(), new MidiWriter.Track()];
        // handle initial gap, if any
        let offset = track.tempi.slice(0, 1);
        new_track[0].setTempo(offset[0].tempo);

        let delta = offset[0].delta;
        track.tempi.slice(1).forEach((tick) => {
            new_track[0].addEvent(new _TempoEvent(delta, tick.tempo));
            if ('timesig' in tick)
                new_track[0].addEvent(new _TimeSignatureEvent(tick.timesig, tick.denom, PPQ));
            delta = ('delta' in tick) ?
                tick.delta : PPQ_mod;
        });
       
        console.log(track);
        track.clicks.forEach((click) => new_track[1].addEvent(new MidiWriter.NoteEvent(click)));
        
        var write = new MidiWriter.Writer(new_track);
        let blob = new Blob([write.buildFile()], {type: "audio/midi"});
        score.file(track.name + '.mid', blob);
    });

    download(zip);
};

export {
    click_track,
}
