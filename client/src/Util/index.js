var MeasureCalc = (features, options) => {
    let start, end, timesig;
    let PPQ;
    ({ start, end, timesig } = features);
    ({ PPQ } = options);
    var ms;
    var beats = [];
    var ticks = [];
    let tick_num = options.PPQ * timesig;
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    let K = 60000.0 / PPQ;
    for (var i=0; i < tick_num; i++) {
        if (!(i%PPQ))
            beats.push(cumulative);
        ticks.push(cumulative);
        cumulative += K / (start + inc*i);
    }
    ms = cumulative;
    beats.push(ms);

    return {start, end, timesig, beats, ms, ticks, offset: features.offset};
}

export { MeasureCalc };
