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

    return {start, end, timesig, beats, ms, ticks, offset: features.offset};
}

var order_by_key = (obj, key) => {
    var merge = (arrL, arrR) => {
        let lI = 0, rI = 0, sorted=[];
        while (lI < arrL.length && rI < arrR.length)
            sorted.push((arrL[lI][key] < arrR[rI][key]) ?
                arrL[lI++] : arrR[rI++]);
        return sorted.concat(arrL.slice(lI)).concat(arrR.slice(rI));
    };

    var sort = (arr) => {
        let m = Math.floor(arr.length / 2);
        return (m ?
            merge(sort(arr.slice(0, m)), sort(arr.slice(m)))
            : arr);
    };

    return sort(Object.keys(obj).map(key => obj[key]));
};

var check_proximity_by_key = (obj, arr, key) => {
    let gap = [-1, Infinity];
    let last_gap = [-1, Infinity];
    arr.some((candidate, ind) => {
        gap = [ind, Math.abs(obj[key] - candidate[key])];
        if (last_gap[1] < gap[1])
            return true;
        last_gap = [ind, gap[1]];
    });
    return last_gap[0];
};
        
var bit_toggle = (list, item) => list ^ (1 << item);

var parse_bits = (n) => {
    let bits = [];
    let counter = 0;
    while(n) {
        if (n & 1)
            bits.push(counter);
        n = n >> 1;
        counter += 1;
    };
    return bits;
};

export { MeasureCalc, order_by_key, check_proximity_by_key, bit_toggle, parse_bits };


