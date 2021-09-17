// backup of global gap calculation code 9/17/21
while (isFinite(bias)) {
    valid = true;
    let result = Object.keys(gapTraces).reduce((acc, key) => {
        console.group();
        let select = gapTraces[key];
        let meas = select.meas;
        console.log(`checking measure ${meas.timesig}/${meas.denom} in inst `, meas.inst);
        // left
        let gap = select.gaps[select.pointer];
        // if there are no gaps (meaning no obstacles), return generic acc
        if (!gap) {
            console.groupEnd();
            return acc;
        }
        let fit = fit_check(meas, -bias, gap);
        let first = select.pointer === 0;
        console.group();
        console.log(`checking bias ${bias} in gap ${select.pointer}: `, gap);
        if (first) {
            let candidate = meas.offset - (select.gaps[0][1]-meas.ms);
            if (gt(candidate, bias))
                acc.nearest = Math.min(candidate, acc.nearest);
        } else
            acc.nearest = Math.min(acc.nearest, meas.offset - (select.gaps[select.pointer-1][1]-meas.ms))

        if (!fit) {
            console.log('measure doesnt fit.');
            if (!first) select.pointer--;
            valid = false;
        } else
            console.log('measure fits.');
        if (valid) {
            acc.wiggle = Math.min(acc.wiggle, meas.offset - gap[0]);
            console.log('everything fits so far. wiggle: ', acc.wiggle);
        }
        console.log('nearest: ', acc.nearest);
        console.groupEnd();
        console.groupEnd();
        return acc;    
    }, {
        nearest: Infinity,
        wiggle: Infinity,
        bias
    });
    if (valid) {
        // link previous result to current one
        result.half = (result.nearest+result.wiggle)*0.5;
        if (left.length) {
            let prev = left[left.length-1];
            prev.next = result;
            prev.break = (result.bias+prev.wiggle)*0.5;
        }
        left.push(result);

    }
    console.log('valid pass: ', valid);
    console.log(result);
    bias = result.nearest;
}

// reset pointers
Object.keys(gapTraces).forEach(key => gapTraces[key].pointer = gapTraces[key].initial);
// find first global obstacle on right
bias = 0;
let right = [];
// the loop continues until gaps are exhausted
while (isFinite(bias)) {
    valid = true;
    let result = Object.keys(gapTraces).reduce((acc, key) => {
        let select = gapTraces[key];
        let meas = select.meas;
        console.log(`checking inst${meas.inst} meas: ${meas.ms} at ${bias+meas.offset}`);
        let gap = select.gaps[select.pointer];
        if (!gap)
            return acc;
        console.log('checking gap ', select.pointer);

        // does the measure fit this gap?
        let fit = fit_check(meas, bias, gap);
        let last = select.pointer >= select.gaps.length-1;


        if (last) {
            let candidate = select.gaps[select.gaps.length-1][0]-meas.offset;
            if (candidate > bias)
                acc.nearest = Math.min(candidate, acc.nearest);
        } else
            acc.nearest = Math.min(select.gaps[select.pointer+1][0]-meas.offset, acc.nearest)

        if (!fit) {
            console.log('measure doesnt fit.');
            if (!last) select.pointer++;
            valid = false;
        } else {
            console.log('measure fits.');
        }
        if (valid) {
            let offset = meas.offset + bias;
            acc.wiggle = Math.min(acc.wiggle, gap[1]-meas.ms-meas.offset); 
            console.log('everything fits so far. wiggle: ', acc.wiggle);
        }
        console.log('nearest: ', acc.nearest);
        return acc;
    }, {
        nearest: Infinity,
        wiggle: Infinity,
        bias
    });
    if (valid) {
        result.half = (result.nearest+result.wiggle)*0.5;
        if (right.length) {
            let prev = right[right.length-1];
            prev.next = result;
            prev.break = (result.bias+prev.wiggle)*0.5;
        }
        right.push(result)
    }
    console.log('valid pass: ', valid);
    console.log(result);
    bias = result.nearest;
}

