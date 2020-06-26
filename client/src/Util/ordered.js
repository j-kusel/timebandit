let find = (node, ms) => {
    if (Math.abs(node.loc - ms) < 5)
        return node;
    if (ms < node.loc) {
        if ('left' in node) 
            return find(node.left, ms)
        else {
            node.left = { parent: node, meas: [] };
            return node.left;
        }
    } else {
        if ('right' in node)
            return find(node.right, ms)
        else {
            node.right = { parent: node, meas: [] };
            return node.right;
        }
    }
}

let insert = (loc, meas, root) => {
    if (!root) {
        let root = { loc, meas: [meas] };
        ('beat_nodes' in meas) ?
            meas.beat_nodes.push(root) :
            meas.beat_nodes = [root];
        return root;
    }
    let node = find(root, loc);
    node.loc = loc;
    node.meas.push(meas);
    ('node' in meas) ?
        meas.beat_nodes.push(node) :
        meas.beat_nodes = [node];
    return root;
}


let edit = (node, { _clear, _target, inst, newMeas }) => {
    let edit = (node, { _clear, _target }) => {
        console.log(_clear, _target);
        // these paths seem convoluted but they limit redundancy
        // as best as possible for the traversals.
        if (node === undefined)
            return;
        let to_clear;
        let to_target;
        if (_clear && Math.abs(node.loc - _clear) < 5) {

            node.meas.splice(node.meas.indexOf(inst));
            // NEED TO REPLACE NODE
        }
        if (_target && Math.abs(node.loc - _target) < 5) {
            node.meas.push(newMeas);
            newMeas.beat_nodes.push(node);
        }
        if (_clear)
            to_clear = (_clear < node.loc) ?
                'left' : 'right';
        if (_target) {
            to_target = (_target < node.loc) ?
                'left' : 'right';
            if (!node[to_target]) {
                node[to_target] = { loc: _target, parent: node, inst: [inst], meas: [newMeas] };
                to_target = null;
            }
        }
                            
        if (to_clear === to_target)
            edit(node[to_clear], { _clear, _target })
        else {
            edit(node[to_clear], { _clear });
            edit(node[to_target], { _target });
        }
    };
    edit(node, { _clear, _target, inst });
}

module.exports = {
    tree: {
        find,
        edit,
        insert
    }
};
