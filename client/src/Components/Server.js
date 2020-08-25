import React, { Component } from 'react';
import styled from 'styled-components';
import { FormInput } from './Styled';
import P5Wrapper from 'react-p5-wrapper';
import measure from '../Sketches/measure';
import c from '../config/CONFIG.json';
import _ from 'lodash';
import socketIOClient from 'socket.io-client';
import { ServerModal } from './Modals';
import { TBButton } from './Styled';

var P5Container = styled.div`
    div {
        padding-left: ${c.CANVAS_PADDING}px;
        z-index: -100;
    }
`;

var socket = null;

class Server extends Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            domain: 'localhost',
            port: 3001,
            registerSocket: props.registerSocket,
            commandStack: {},
            sustain: 150,
            showModal: false,
        }

        
        this.handleDomain = this.handleDomain.bind(this);
        this.handlePort = this.handlePort.bind(this);
        this.handleNetworkChange = this.handleNetworkChange.bind(this);
        this.handleCommand = this.handleCommand.bind(this);
        this.handleSustain = this.handleSustain.bind(this);
        this.handleNetworkChange(null);
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

    handleSustain(e) {
        let value = e.target.value;

        if (value.length > 3 ||
            !isFinite(value))
            return;

        // cache changed parameters
        this.setState(oldState => {
            let commandStack = Object.assign({}, oldState.commandStack);
            if (value === this.state.sustain) 
                delete commandStack.sustain
            else
                commandStack.sustain = value;
            return ({ commandStack });
        });
    }

    handleCommand(e, send, modal) {
        if (e)
            e.preventDefault();
        let newState = {};
        if (modal)
            newState.showModal = false;
        if (!send) {
            newState.commandStack = {};
            this.setState(newState);
            return;
        }

        if (socket.disconnected)
            alert('server not connected!')
        else {
            let newState = {};
            Object.keys(this.state.commandStack).forEach((key) => {
                socket.emit('command', [key, this.state.commandStack[key]].join(' '));
                newState[key] = this.state.commandStack[key];
            });
            this.setState(newState);
        }
    }

    handleNetworkChange(e) {
        if (e)
            e.preventDefault();
        if (socket)
            socket.close();
        socket = socketIOClient(`http://${this.state.domain}:${this.state.port}`)

        socket.on('connect', () => {
        });
        socket.on('disconnect', () => {
        });

        socket.on('err', (err) => {
            console.error(err);
        });

        this.state.registerSocket(socket);
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
            color: socket.connected ? 'green' : 'red',
        }
        let text = socket.connected ? 'connected' : 'disconnected';

        return (
            <div style={this.props.style}>
                <h3 style={{fontSize: '10px'}}>Hardware server: <span style={style}>{text}</span></h3>
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
                <TBButton onClick={() => this.setState({ showModal: true })}>parameters...</TBButton>
                <ServerModal
                    show={this.state.showModal}
                    onHide={() => this.handleCommand(null, false, true)}
                >
                    <form onSubmit={(e) => this.handleCommand(e, true)} autoComplete="off">
                      <FormInput
                        type="text"
                        key="sustain"
                        value={(this.state.commandStack.sustain === '') ? '' :
                            (this.state.commandStack.sustain || this.state.sustain)
                        }
                        id="sustain"
                        name="sustain"
                        onChange={this.handleSustain}
                      />
                        <hr/>
                        <button type="submit" disabled={socket.disconnected}>Transfer</button>
                        <button type="button" onClick={() => this.handleCommand(null, false, true)}>Cancel</button>
                    </form>
                       
                    
                </ServerModal>

                
            
            </div>
        );
    };
};

export default Server;
