import React, { Component } from 'react';
import styled from 'styled-components';
import P5Wrapper from 'react-p5-wrapper';
import measure from '../Sketches/measure';

class UI extends Component {

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.locks.length !== this.props.locks.length)
            return true;
        if (nextProps.instruments.length !== this.props.instruments.length)
            return true;
        if (nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ)
            return true;
        let flag = false;
        nextProps.instruments.forEach((inst, index) => {
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
        var paddingLeft = 0;

        var P5Container = styled.div`
            div {
                padding-left: ${paddingLeft}px;
            }
        `;


        return (
            <div>
                <P5Container>
                    <P5Wrapper key={1} className="p5" sketch={measure} instruments={this.props.instruments} locks={this.props.locks} API={this.props.API} CONSTANTS={this.props.CONSTANTS} />
                </P5Container>
            </div>
        );
    };
};

export default UI;