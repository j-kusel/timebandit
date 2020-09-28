import React, { Component } from 'react';
import _ from 'lodash';
import c from '../config/CONFIG.json';
import { Container, Col, Row, InputGroup } from 'react-bootstrap';
import { ArrowButton, FormInput, FormLabel } from './Styled';
import socketIOClient from 'socket.io-client';
import { ServerModal } from './Modals';
import { PanelHeader, TBButton, InstInput } from './Styled';

var socket = null;

/**
 * Component which connects to a bandit server, for external software/hardware integration
 * @component
 * @namespace
 * @param props
 * @param {function} props.registerSocket - Exposes a socket.io instance to {@link App}
 */
class Server extends Component {
    constructor(props, context) {
        super(props, context);

        /**
         * React state
         * @name Server#state
         * @property {string} domain - Hostname of server
         * @property {number} port - Port of server
         * @property {Object} registerSocket - Exposes a socket.io instance to {App}
         * @property {Object} commandQueue - Queues commands for bandit hardware
         * @property {number} sustain - Default buzzer length for bandit hardware
         * @property {Boolean} showModal - Toggles modal for sending commands to server
         */
        this.state = {
            domain: 'localhost',
            port: 3001,
            registerSocket: props.registerSocket,
            commandQueue: {},
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

    /**
     * Change [this.state.domain]{@link Server#state.domain}
     * @memberOf Server
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     */
    handleDomain(e) {
        this.setState({ domain: e.target.value });
    }

    /**
     * Change [this.state.port]{@link Server#state.port}
     * @memberOf Server
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     */
    handlePort(e) {
        if (e.target.value.length > 5 ||
            !isFinite(e.target.value))
            return;
        this.setState({ port: e.target.value });
    }

    /**
     * Change [this.state.commandQueue.sustain]{@link Server#state.commandQueue}
     * @memberOf Server
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     */
    handleSustain(e) {
        let value = e.target.value;

        if (value.length > 3 ||
            !isFinite(value))
            return;

        // cache changed parameters
        this.setState(oldState => {
            let commandQueue = Object.assign({}, oldState.commandQueue);
            if (value === this.state.sustain) 
                delete commandQueue.sustain
            else
                commandQueue.sustain = value;
            return ({ commandQueue });
        });
    }

    /**
     * Change [this.state.commandQueue.sustain]{@link Server#state.commandQueue}
     * @memberOf Server
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     * @param send {Boolean} - Whether or not [this.state.commandQueue]{@link Server#state.commandQueue} will be sent to server or cleared
     * @param modal {Boolean} - Whether or not the command modal will be shown
     */
    handleCommand(e, send, modal) {
        if (e)
            e.preventDefault();
        let newState = {};
        if (modal)
            newState.showModal = false;
        if (!send) {
            newState.commandQueue = {};
            this.setState(newState);
            return;
        }

        if (socket.disconnected)
            alert('server not connected!')
        else {
            let newState = {};
            Object.keys(this.state.commandQueue).forEach((key) => {
                socket.emit('command', [key, this.state.commandQueue[key]].join(' '));
                newState[key] = this.state.commandQueue[key];
            });
            this.setState(newState);
        }
    }

    /**
     * Connects to server and registers socket to {@link App}
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     */
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

    render() {
        let style = {
            color: socket.connected ? 'green' : 'red',
        }
        let text = socket.connected ? 'connected' : 'disconnected';

        return (
            <div style={this.props.style}>
                <PanelHeader>Hardware server: <span style={style}>{text}</span></PanelHeader>
                <form onSubmit={this.handleNetworkChange} autoComplete="off">
                    <InstInput>
                        <FormInput
                            type="text"
                            key="domain"
                            value={this.state.domain}
                            id="domain"
                            name="domain"
                            onChange={this.handleDomain}
                            style={{ width: '98px', textAlign: 'right' }}
                        />
                            <span style={{ fontSize: '8pt', paddingTop: '1px', color: c.secondary, backgroundColor: c.primary, borderTop: '1px solid black', borderBottom: '1px solid black' }}>:</span>
                        <FormInput
                            type="text"
                            key="port"
                            value={this.state.port}
                            id="port"
                            name="port"
                            onChange={this.handlePort}
                        />
                        <InputGroup.Append>
                            <ArrowButton type="submit" disabled={!this.state.instName}>&#x25BA;</ArrowButton>
                        </InputGroup.Append>
                    </InstInput>
                </form>
                <TBButton style={{ marginLeft: '4px' }} onClick={() => this.setState({ showModal: true })}>parameters...</TBButton>
                <ServerModal
                    show={this.state.showModal}
                    onHide={() => this.handleCommand(null, false, true)}
                >
                    <form onSubmit={(e) => this.handleCommand(e, true)} autoComplete="off">
                      <Container>
                        <Row>
                            <Col xl={6}><FormLabel>sustain (ms)</FormLabel></Col>
                            <Col xl={6}>
                               <FormInput
                                type="text"
                                key="sustain"
                                value={(this.state.commandQueue.sustain === '') ? '' :
                                    (this.state.commandQueue.sustain || this.state.sustain)
                                }
                                id="sustain"
                                name="sustain"
                                onChange={this.handleSustain}
                              />
                            </Col>
                        </Row>
                      </Container>
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
