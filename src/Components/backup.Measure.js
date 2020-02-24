import React, { Component } from 'react';
import measure from '../Sketches/measure';
import P5Wrapper from 'react-p5-wrapper';
import styled from 'styled-components';


class Measure extends Component {

    constructor(props) {
        super(props)
        this.state = {
            start: props.start,
            end: props.end,
            beats: props.beats,
            PPQ: props.PPQ,
            spacer: 0
        }

        let ticks = props.PPQ * props.beats;
        let cumulative = 0.0;
        let inc = (props.end-props.start)/ticks;
        for (var i=0; i<ticks; i++) {
            cumulative += (60000.0/(props.start + inc*i))/props.PPQ;
        }

        this.state.len = cumulative;
        console.log(cumulative);
        this.handleLoc = this.handleLoc.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (parseInt(nextProps.offset) !== parseInt(this.props.offset)) {
            this.setState(oldState => ({spacer: nextProps.offset}));
        }
    }    

    handleLoc(loc) {
        console.log(loc);
    }

    render() {
        var paddingLeft = this.props.offset * window.innerWidth / this.props.sizing;
        var P5Container = styled.div`
            div {
                padding-left: ${paddingLeft}px;
            }
        `;
        
        return (
            <P5Container>
                <P5Wrapper className="p5" callback={(loc) => this.handleLoc(loc)} style={{paddingLeft:paddingLeft}} sketch={measure} selected={this.props.selected} len={this.props.len} beats={this.props.beats} sizing={this.props.sizing} scope={window.innerWidth}/>
            </P5Container>
        )
    }
}

export default Measure;
