import MidiWriter from 'midi-writer-js';
import JSZip from 'jszip';

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
        console.log(this.data);
    }
};

export default (tracks, PPQ) => {
    MidiWriter.Constants.HEADER_CHUNK_DIVISION = [0x00, PPQ.toString(16)];
    var zip = new JSZip();
    var score = zip.folder('score');

    tracks.forEach((track) => {
        var new_track = [new MidiWriter.Track(), new MidiWriter.Track()];
        // handle initial gap, if any
        let offset = track.tempi.slice(0, 1);
        new_track[0].setTempo(offset[0].tempo);

        let delta = offset[0].delta;
        track.tempi.slice(1).forEach((tick) => {
            new_track[0].addEvent(new _TempoEvent(delta, tick.tempo));
            delta = ('delta' in tick) ?
                tick.delta : 1;
        });
       
        track.beats.forEach((beat) => new_track[1].addEvent(new MidiWriter.NoteEvent(beat)));
        
        var write = new MidiWriter.Writer(new_track);
        let blob = new Blob([write.buildFile()], {type: "audio/midi"});
        score.file(track.name + '.mid', blob);
    });

    var dlLink = document.createElement('a');
    dlLink.download = 'score.zip';

    zip.generateAsync({ type: 'blob' })
        .then((blob) => {
            dlLink.href = window.URL.createObjectURL(blob);
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
        }, (err) => console.log(err));
};
