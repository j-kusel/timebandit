import React, { Component } from 'react';
import styled from 'styled-components';
import P5Wrapper from 'react-p5-wrapper';
import measure from '../Sketches/measure';
import c from '../config/CONFIG.json';

var P5Container = styled.div`
    div {
        padding-left: ${c.CANVAS_PADDING}px;
        z-index: -100;
    }
`;


class UI extends Component {

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {

        if (nextProps.mode !== this.props.mode)
            return true;
        if (nextProps.panels !== this.props.panels)
            return true;
        if (nextProps.insertMeas !== this.props.insertMeas)
            return true;
        if (nextProps.editMeas !== this.props.editMeas)
            return true;
        if (nextProps.locks.length !== this.props.locks.length) {
            return true;
        }
        if (nextProps.instruments.length !== this.props.instruments.length)
            return true;
        if (nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ)
            return true;
        let flag = false;
        nextProps.instruments.forEach((inst, index) => {
            if (Object.keys(inst.measures).length !== Object.keys(this.props.instruments[index].measures).length)
                flag = true;
            Object.keys(inst.measures).forEach((key) => {
                if (!(key in this.props.instruments[index].measures)) {
                    flag = true;
                } else {
                    ['start', 'end', 'offset'].forEach((attr) => {
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
                    <P5Wrapper key={1} className="p5" sketch={measure} instruments={this.props.instruments} editMeas={this.props.editMeas} insertMeas={this.props.insertMeas} panels={this.props.panels} mode={this.props.mode} locks={this.props.locks} API={this.props.API} CONSTANTS={this.props.CONSTANTS} />
                </P5Container>
            </div>
        );
    };
};

export default UI;
