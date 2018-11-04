import React, { Component } from 'react';
import measure from '../Sketches/measure';
import P5Wrapper from 'react-p5-wrapper';


class Measure extends Component {

    constructor(props) {
        super(props)
        this.state = {
            start: props.start,
            end: props.end,
            beats: props.beats,
            PPQ: props.PPQ
        }

        let ticks = props.PPQ * props.beats;
        let cumulative = 0.0;
        let inc = (props.end-props.start)/ticks;
        for (var i=0; i<ticks; i++) {
            cumulative += (60000.0/(props.start + inc*i))/props.PPQ;
        }

        this.state.len = cumulative;
        console.log(cumulative);
    }

    render() {
        return (
            <P5Wrapper sketch={measure} len={this.props.len} beats={this.props.beats} sizing={this.props.sizing} scope={window.innerWidth}/>
        )
    }
}

export default Measure;
