import React, { Component } from 'react';
import styled from 'styled-components';
import P5Wrapper from 'react-p5-wrapper';
import measure from '../Sketches/measure';
import c from '../config/CONFIG.json';
import _ from 'lodash';

var P5Container = styled.div`
    div {
        padding-left: ${c.CANVAS_PADDING}px;
        z-index: -100;
    }
`;


class UI extends Component {

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {

        /*
            console.log(nextProps.mode !== this.props.mode);
            console.log(!_.isEqual(nextProps.insertMeas, this.props.insertMeas));
            console.log(!_.isEqual(nextProps.editMeas, this.props.editMeas));
            console.log(!_.isEqual(nextProps.API.registerTuts, this.props.API.registerTuts));
            console.log(nextProps.locks.length !== this.props.locks.length);
            console.log(nextProps.instruments.length !== this.props.instruments.length);
            console.log(nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ);
        */
        if (nextProps.mode !== this.props.mode ||
            nextProps.newInst !== this.props.newInst ||
            !_.isEqual(nextProps.insertMeas, this.props.insertMeas) ||
            !_.isEqual(nextProps.editMeas, this.props.editMeas) ||
            // does registerTuts work here?
            //!_.isEqual(nextProps.API.registerTuts, this.props.API.registerTuts) ||
            nextProps.locks.length !== this.props.locks.length ||
            nextProps.instruments.length !== this.props.instruments.length ||
            nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ) {
            return true;
        }

        /*if (nextProps.mode !== this.props.mode)
            {console.log('MODE'); return true;}
        if (!_.isEqual(nextProps.insertMeas, this.props.insertMeas))
            {console.log('INSERTMEAS'); return true;}

        if (!_.isEqual(nextProps.editMeas, this.props.editMeas))
            {console.log('EDITMEAS'); console.log(nextProps.editMeas, this.props.editMeas); return true;}
        if (nextProps.locks.length !== this.props.locks.length) {
            {console.log('LOCKS'); return true;}
        }
        if (nextProps.instruments.length !== this.props.instruments.length)
        {console.log('INSTRUMENTS'); return true;}
        if (nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ)
        {console.log('CONSTANTS'); return true;}
        */
        let flag = false;
        nextProps.instruments.forEach((inst, index) => {
            if (Object.keys(inst.measures).length !== Object.keys(this.props.instruments[index].measures).length)
                flag = true;
            Object.keys(inst.measures).forEach((key) => {
                if (!(key in this.props.instruments[index].measures)) {
                    flag = true;
                } else {
                    ['start', 'end', 'offset', 'timesig'].forEach((attr) => {
                        if (inst.measures[key][attr] !== this.props.instruments[index].measures[key][attr])
                            flag = true;
                    });
                };
            })
        });
        return flag;
    };

    render() {
        return (
            <div>
                <P5Container>
                    <P5Wrapper key={1} className="p5" sketch={measure} instruments={this.props.instruments} editMeas={this.props.editMeas} insertMeas={this.props.insertMeas} newInst={this.props.newInst} mode={this.props.mode} locks={this.props.locks} API={this.props.API} CONSTANTS={this.props.CONSTANTS} />
                </P5Container>
            </div>
        );
    };
};

export default UI;
