import React, { Component } from 'react';
import styled from 'styled-components';
import { FormInput } from './Styled';
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


class Server extends Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            connected: false,
            domain: 'localhost',
            port: 3001
        }

        this.handleDomain = this.handleDomain.bind(this);
        this.handlePort = this.handlePort.bind(this);
        this.handleNetworkChange = this.handleNetworkChange.bind(this);
    }

    handleDomain(e) {
        this.setState({ domain: e.target.value });
    }

    handlePort(e) {
        if (e.target.value.length > 4 ||
            !isFinite(e.target.value))
            return;
        this.setState({ port: e.target.value });
    }

    handleNetworkChange(e) {
        e.preventDefault();
        console.log(this.state.domain, this.state.port);
    }
        
       

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {
    /*
        if (nextProps.mode !== this.props.mode ||
            nextProps.panels !== this.props.panels ||
            !_.isEqual(nextProps.insertMeas, this.props.insertMeas) ||
            !_.isEqual(nextProps.editMeas, this.props.editMeas) ||
            nextProps.locks.length !== this.props.locks.length ||
            nextProps.instruments.length !== this.props.instruments.length ||
            nextProps.CONSTANTS.PPQ !== this.props.CONSTANTS.PPQ) {
            return true;
        }

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
        */
        return true;
    };


    render() {

        let style = {
            color: this.state.connected ? 'green' : 'red',
        }
        let text = this.state.connected ? 'connected' : 'disconnected';

        return (
            <div style={this.props.style}>
                <h3 style={{fontSize: '10px'}}>Server status: <span style={style}>{text}</span></h3>
                <form onSubmit={this.handleNetworkChange} autoComplete="off">
                    <FormInput
                        type="text"
                        key="domain"
                        value={this.state.domain}
                        id="domain"
                        name="domain"
                        onChange={this.handleDomain}
                    />:
                    <FormInput
                        type="text"
                        key="port"
                        value={this.state.port}
                        id="port"
                        name="port"
                        onChange={this.handlePort}
                    />
                    
                    <button type="submit">&#x219D;</button>
                </form>

                
            
            </div>
        );
    };
};

export default Server;
