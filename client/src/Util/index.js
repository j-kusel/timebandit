import c from '../config/CONFIG.json';

// finds adjacent measures and returns their location and distance
var crowding = (gaps, position, ms, options) => {
    let center = (options && 'center' in options) ? options.center : false;
    let strict = (options && 'strict' in options) ? options.strict : false;
    let impossible = (options && 'impossible' in options) ? options.impossible : false;
    let final = position + ms;
    let mid = position + ms/2;
    if (final <= gaps[0][1]) {
        console.log('first ', final, gaps[0][1]);
        return { start: [-Infinity, Infinity], end: [gaps[0][1], gaps[0][1] - (final)] };
    }
    let last_gap = gaps.slice(-1)[0];
    if (position > last_gap[0]) {
        console.log('last');
        return { start: [last_gap[0], position - last_gap[0]], end: [Infinity, Infinity] };
    }
        
    return gaps
        .reduce((acc, gap, ind) => {
            // does it even fit in the gap?
            if (!impossible && (gap[1] - gap[0] < ms - (strict ? c.NUDGE_THRESHOLD*2 : 0)))
                return acc;
            let start = [gap[0], position - gap[0]];
            let end = [gap[1], gap[1] - final];

            // attempt 3: is the start or end 

            // trying something new... base closest gap on the center of the given spread,
            // in relation to the start or end of available gaps.
            if (center) {
                let target = (gap[0]+acc.end[0])/2;
                // if the previous gap start is -Infinity and 
                //if ((!isFinite(acc.start[0]) && )
                //    || mid < (gap[0]+acc.end[0])/2))
                if (isFinite(target) && mid < target)
                    return acc;
            }

            // is there ever an instance where these two aren't both triggered?

            // 1. if the distance to the start of the gap is less than the previous,
            // update the returned gap.
            if (Math.abs(start[1]) < Math.abs(acc.start[1]) ||
                (Math.abs(end[1]) < Math.abs(acc.end[1])))
                return ({ start, end, gap: ind });
            // 2. if the distance to the end of the gap is less than the previous,
            // update the returned gap.
            //if (Math.abs(end[1]) < Math.abs(acc.end[1]))
            //    acc.end = end;
            return acc;
        }, { start: [0, Infinity], end: [0, Infinity], gap: -1 });
}

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
        return false;
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

export { MeasureCalc, order_by_key, check_proximity_by_key, bit_toggle, parse_bits, crowding };


