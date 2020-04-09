var MeasureCalc = (features, options) => {
    let start, end, timesig;
    let PPQ, PPQ_tempo;
    ({ start, end, timesig } = features);
    ({ PPQ, PPQ_tempo } = options);
    var ms;
    var beats = [];
    var ticks = [];
    let tick_num = options.PPQ * timesig;
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    let K = 60000.0 / PPQ;
    let PPQ_mod = PPQ / PPQ_tempo;
    let last = 0;
    for (var i=0; i < tick_num; i++) {
        if (!(i%PPQ))
            beats.push(cumulative);
        ticks.push(cumulative);
        if (i%PPQ_mod === 0)
            last = K / (start + inc*i);
        cumulative += last;
    }
    ms = cumulative;
    beats.push(ms);

    console.log(beats);

    return {start, end, timesig, beats, ms, ticks, offset: features.offset};
}

export { MeasureCalc };
