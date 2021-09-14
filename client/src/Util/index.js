import c from '../config/CONFIG.json';

const FLOAT_MUL = Math.pow(10, 8);
const MUL = (x) => Math.round(x*FLOAT_MUL)/FLOAT_MUL;

var lt = (x, y) =>
    (isFinite(x) ? MUL(x):x) //x.toFixed(FLOAT):x)
        < (isFinite(y) ? MUL(y):y)//y.toFixed(FLOAT):y);
var lte = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        <= (isFinite(y) ? MUL(y):y);
var gt = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        > (isFinite(y) ? MUL(y):y);
var gte = (x, y) =>
    (isFinite(x) ? MUL(x):x)
        >= (isFinite(y) ? MUL(y):y);

// finds adjacent measures and returns their location and distance
var crowding = (gaps, position, ms, { center=false, strict=false, context=false, impossible=false } = {}) => {
    let final = position + ms;
    let context_final = context ?
        context.position + context.ms : final;
    let mid = position + ms*0.5;
    let context_mid = context ?
        context.position + context.ms*0.5 : mid;
    let offset = context ?
        context.position : position;
    let context_ms = context ?
        context.ms : ms;

    // changing the criteria for first/last -
    // this seems to work well for editor validation but we may
    // still have problems down the line
    if (context_final <= gaps[0][1] || offset <= gaps[0][1]) {
        return { start: [-Infinity, Infinity], end: [gaps[0][1], gaps[0][1] - (final)] };
    }
    let last_gap = gaps.slice(-1)[0];
    if (offset > last_gap[0] || context_final > last_gap[0]) {
        return { start: [last_gap[0], position - last_gap[0]], end: [Infinity, Infinity] };
    }
        
    return gaps
        .reduce((acc, gap, ind) => {
            // does it even fit in the gap?
            if (!impossible && (gap[1] - gap[0] < context_ms - (strict ? c.NUDGE_THRESHOLD*2 : 0)))
                return acc;
            let start = [gap[0], position - gap[0]];
            let end = [gap[1], gap[1] - final];

            // trying something new... base closest gap on the center of the given spread,
            // in relation to the start or end of available gaps.
            if (center) {
                let target = (gap[0]+acc.end[0])/2;
                // if the previous gap start is -Infinity and 
                //if ((!isFinite(acc.start[0]) && )
                //    || mid < (gap[0]+acc.end[0])/2))
                if (isFinite(target) && context_mid < target)
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

var initial_gap = (gaps, offset, ms, /*current*/) => {
    // right now this starts by finding the first 
    let current = -1;
    gaps.some((gap, i) => {
        if (offset >= gap[0] &&
            offset + ms <= gap[1]
        ) {
            current = i;
            return true;
        }
        return false;
    });
    let gap_left, gap_right;
    var search_gap = (current, dir) => {
        // left and right boundaries of current gap
        let left = gaps[current][0];
        let right = gaps[current][1];

        // too big? keep searching
        if (ms > right - left) {
            if (dir > 0)
                return search_gap(current+1, dir);
            return search_gap(current-1, dir);
        }
        return gaps[current];
    }

    // left and right search
    // later, allow previous caches to be passed in to reduce gap search calculations
    if (current-1 > -1)
        gap_left = search_gap(current-1, -1);
    if (current+1 < gaps.length)
        gap_right = search_gap(current+1, 1);

    return { 
        left: gap_left, right: gap_right,
        wiggle: [
            offset - gaps[current][0],
            gaps[current][1] - (offset + ms)
        ]
    }
    // something here about return false or recurse if negative

}

var anticipate_gap = (gaps, offset, ms, /*current*/) => {
    let [left, current, right] = [null, null, null];
    let end = offset+ms;
    console.log(offset, ms, end);
    console.log('checking gaps: ', gaps);
    let valid = gaps.some((gap, i) => {
        console.log(offset, end);
        if (gte(offset, gap[0]) && lte(end, gap[1])) {
            console.log('this fits');

            current = gap;
            if (i<gaps.length-1)
                right = gaps[i+1];
            return true;
        } else console.log('this doesnt fit');
        if (lte(ms, gap[1] - gap[0]))
            left = gap;
    });
    console.log(gaps, gaps.length, offset);
    if (!(valid || right))
        right = [gaps[gaps.length-1][0]];



    //console.log(left, right, current);

    // if measure is valid, return its wiggle room,
    // otherwise return the distance in either direction
    // to the previous/next gap
    let obj = {
        valid,
        resolution: [
            left ? offset - (left[1]-ms) : Infinity, //null,
            right ? right[0] - offset : Infinity //null
        ]
    };
    if (valid)
        obj.wiggle = [
            offset - current[0],
            current[1] - (offset + ms)
        ];

    return obj;
}

var MeasureCalc = (features, options) => {
    let start, end, timesig, denom;
    let PPQ, PPQ_tempo;
    ({ start, end, timesig, denom } = features);
    if (!denom)
        denom = 4;
    ({ PPQ, PPQ_tempo } = options);
    var ms;
    var beats = [];
    var ticks = [];
    let divisor = denom/4;
    let tick_num = options.PPQ * (timesig/divisor);
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    let K = 60000.0 / PPQ;
    let PPQ_mod = PPQ / PPQ_tempo;
    let local_PPQ = PPQ/divisor;
    let last = 0;
    for (var i=0; i < tick_num; i++) {
        if (!(i%local_PPQ))
            beats.push(cumulative);
        ticks.push(cumulative);
        if (i%PPQ_mod === 0)
            last = K / (start + inc*i);
        cumulative += last;
    }
    ms = cumulative;
    beats.push(ms);

    return {start, end, timesig, denom, beats, ms, ticks, offset: features.offset};
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

export { MeasureCalc, order_by_key, check_proximity_by_key,
    bit_toggle, parse_bits, crowding, anticipate_gap, initial_gap,
    lt, lte, gt, gte
};


