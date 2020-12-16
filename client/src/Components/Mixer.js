import React, { Component } from 'react';
import styled from 'styled-components';
import { Popover, Overlay, Container, Row, Col } from 'react-bootstrap';
import { FormInput, FormLabel, MixerRow, MixerArrow, MixerButton, TBDropdown, Slider, colors } from 'bandit-lib';
import { Module, PanelHeader } from 'bandit-lib';
import _ from 'underscore';

const sine = (
    <svg width="80%" height="100%" viewBox="0 0 190 160" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 80  C 40 10, 65 10, 95 80 S 150 150, 180 80 Z" stroke="currentColor" fill="currentColor"/>
    </svg>
);

const SynthButton = styled.button`
    border: none;
    width: 26px;
    padding: 0px 2px;
    color: ${colors.contrast_lighter};
    background-color: ${colors.secondary};
    &:hover {
        color: ${colors.contrast};
    }
`;

const Synth = styled(Container)`
    width: 300px;
    background: ${colors.secondary};
    color: ${colors.primary};
    border: 1px solid black;
`;

const StyledFormInput = styled(FormInput)`
    -webkit-outer-spin-button,
    -webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    -moz-appearance: textfield;
`;


/**
 * Component which connects to a bandit server, for external software/hardware integration
 * @component
 * @namespace
 * @param props
 * @param {function} props.registerSocket - Exposes a socket.io instance to {@link App}
 */
class Mixer extends Component {
    constructor(props, context) {
        super(props, context);

        /**
         * React state
         * @name Mixer#state
         * @property {Boolean[]} mutes - Whether or not an indexed instrument is muted
         * @property {Boolean[]} solos - Whether or not an indexed instrument is soloed
         * @property {Number[]} volumes - Volumes of indexed instruments (0-100)
         * @property {Number} volShows - Which volume indicator is displayed, -1 if none
         */
        this.state = {
            mutes: props.insts.reduce((acc, i) => ({...acc, [i.audioId]: false }), {}),
            solos: props.insts.reduce((acc, i) => ({...acc, [i.audioId]: false }), {}),
            volumes: props.insts.reduce((acc, i) => ({...acc, [i.audioId]: 80 }), {}),
            /*mutes: props.insts.map(__ => false),
            solos: props.insts.map(__ => false),
            volumes: props.insts.map(__ => 80),
            */
            frequencies: props.insts.reduce((acc, i) => ({
                ...acc,
                [i.audioId]: this.props.audio.getFrequency(i.audioId),
            }), {}),
            types: props.insts.reduce((acc, i) => ({
                ...acc,
                [i.audioId]: this.props.audio.getType(i.audioId),
            }), {}),
            volShows: -1
        }
        
        this.handleMute = this.handleMute.bind(this);
        this.handleSolo = this.handleSolo.bind(this);
        this.handleVolume = this.handleVolume.bind(this);
        this.handleShow = this.handleShow.bind(this);

        this.setFrequency = this.setFrequency.bind(this);
        this.submitFrequency = this.submitFrequency.bind(this);
        this.handleType = this.handleType.bind(this);

        this.popRefs = [0,1,2,3,4,5,6,7,8,9].reduce((acc, ind) => Object.assign(acc, { ['pop' + ind]: React.createRef() }), {}); //{ 'pop0': React.createRef(), 'pop1': React.createRef() };
        this.state.popShows = [0,1,2,3,4,5,6,7,8,9].reduce((acc, ind) => Object.assign(acc, { ['pop' + ind]: false }), {} );

        
    }

    static getDerivedStateFromProps(props, state) {
        let defaults = { mutes: false, solos: false, volumes: 80 };
        let newState = Object.assign({}, state);
        //newState.popShows = {};
        props.insts.forEach((inst, ind) => {
            let ref = 'pop' + ind;
            //newState.popShows[ref] = false;
            let id = inst.audioId;
            Object.keys(defaults).forEach(key => {
                if (!(id in state[key]))
                    newState[key][id] = defaults[key];
            });
        });

        /*
        let newState = Object.keys(defaults).reduce((acc, key) =>
            Object.assign(acc, {
                [key]: props.insts.reduce((acc, i) => {
                    console.log(i.audioId);
                    console.log((i.audioId in state[key]) ?
                        state[key][i] : defaults[key])
                })
            }), {}
        );
        */

        return newState;
    }

    componentDidUpdate(prevProps) {
        /*this.popRefs = {};
        let popShows = {};
        this.props.insts.forEach((inst, ind) => {
            let ref = 'pop' + ind;
            this.popRefs[ref] = React.createRef();
            //this.state.popShows[ref] = false;
        });
        console.log(this.popRefs);
        return true;
        */
    }

    handleType(id, type) {
        if (this.state.types[id] === type)
            return;
        this.props.audio.setType(id, type);
        this.setState(oldState => {
            let types = Object.assign({}, this.state.types);
            types[id] = type;
            return ({ types });
        });
    }

    setFrequency(id, freq) {
        this.setState(oldState => {
            let frequencies = oldState.frequencies;
            frequencies[id] = parseInt(freq, 10);
            return ({ frequencies });
        });
    }

    submitFrequency(id, freq) {
        if (freq > 20 && freq < 20000)
            return this.props.audio.setFrequency(id, freq);
        this.setState(oldState => {
            let frequencies = oldState.frequencies;
            frequencies[id] = this.props.audio.getFrequency(id);
            return ({ frequencies });
        });
    }

    handleShow(ref_id, bool) {
        console.log(ref_id);
        console.log(bool);
        let popShows = Object.assign({}, this.state.popShows);
        Object.keys(popShows).forEach(key => popShows[key] = false);
        popShows[ref_id] = bool;
        console.log(popShows);
        this.setState({ popShows });
    }

    /**
     * Toggles items by index in [this.state.mutes]{@link Mixer#state.mutes}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleMute(index, id) {
        this.props.audio.mute(id, !this.state.mutes[id]);
        this.setState(oldState => {
            let mutes = oldState.mutes;
            mutes[id] = !oldState.mutes[id];
            return ({ mutes });
        });
    }

    /**
     * Solos playback of items by index in [this.state.mutes]{@link Mixer#state}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleSolo(index, id) {
        this.props.audio.solo(id, !this.state.solos[id]);
        this.setState(oldState => ({
            mutes: Object.keys(oldState.mutes).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
            solos: Object.keys(oldState.solos).reduce((acc, key) => 
                ({ [key]: !oldState.solos[key] && key === id })
            , {}),
        }));
    }

    /**
     * Changes instrument metronome volume via [audio.setVolume]{@link audio#setVolume}
     * @memberOf Mixer
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     * @param {Number} index - Index of target instrument
     */
    handleVolume(e, index, id) {
        let vol = parseInt(e.target.value, 10);
        this.props.audio.setVolume(id, vol/100.0);
        this.setState(oldState => {
            let volumes = oldState.volumes;
            let volShows = index;
            volumes[id] = vol;
            return ({ volumes, volShows });
        });
    }

    render() {
        /*this.popRefs = {};
        this.popShows = {};
        this.props.insts.forEach((__, i) => {
            let ref = 'pop' + i;
            this.popRefs[ref] = React.createRef();
            this.popShows[ref] = false;
            console.log(this.popRefs['pop' + i]);
        });
        */


        let popover = (props) => (
            <Popover id="synth">
                <Popover.Content>
                    <p>hello world {props.index}</p>
                </Popover.Content>
            </Popover>
        );
        let insts = this.props.insts.map((inst, i) => {
            return (
            <MixerRow key={i} style={{ fontSize: '8px' }}>
                <td className="arrows" style={{ minWidth: '10px' }}>
                    <MixerArrow onClick={() => this.props.instMove(i, 'up')}>&#9650;</MixerArrow>
                    <MixerArrow onClick={() => this.props.instMove(i, 'down')}>&#9660;</MixerArrow>
                </td>
                <td>{inst.name}</td>
                <td><MixerButton style={{color: this.state.mutes[inst.audioId] ? 'red' : 'black' }} onClick={() => this.handleMute(i, inst.audioId)}>M</MixerButton></td>
                <td><MixerButton style={{color: this.state.solos[inst.audioId] ? 'blue' : 'black' }} onClick={() => this.handleSolo(i, inst.audioId)}>S</MixerButton></td>
                <td><Slider type="range" min="0" max="100" value={this.state.volumes[inst.audioId]} onChange={(e) => this.handleVolume(e, i, inst.audioId)} onMouseUp={() => this.setState({ volShows: -1 })}/></td>
        
                <td>{this.state.volShows === i ? this.state.volumes[i] : null}</td>
                <td>
                    <SynthButton ref={this.popRefs['pop' + i]} onClick={() => this.handleShow('pop' + i, !this.state.popShows['pop' + i])}>{sine}</SynthButton>
                    <Overlay target={this.popRefs['pop' + i].current} show={this.state.popShows['pop' + i]} placement="right">
                    
            {/*<Popover id="synth">
                            <Popover.Content>*/}
                        {({ placement, arrowProps, show: _show, popper, ...props }) => (
                            <Synth {...props}>
                                <Row>
                                    <Col>
                                        <FormLabel style={{margin: '0px'}}>frequency</FormLabel>
                                    </Col>
                                    <Col>
                                        <StyledFormInput
                                            type="number"
                                            defaultValue={this.state.frequencies[inst.audioId]}
                                            placeholder={this.props.audio.getFrequency(inst.audioId)}
                                            onBlur={e => this.submitFrequency(inst.audioId, parseInt(e.target.value, 10))}
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col>
                                        <FormLabel style={{margin: '0px'}}>type</FormLabel>
                                    </Col>
                                    <Col>
                                        <TBDropdown
                                            height={20}
                                            toggle={this.state.types[inst.audioId]}
                                            onSelect={(key, e) => this.handleType(inst.audioId, key)}
                                            menuItems={this.props.audio.WAVES.map(wave => ({
                                                eventKey: wave,
                                                text: wave
                                            }))}
                                        />
                                    </Col>
                                </Row>
                            </Synth>
                        )}
            {/*</Popover.Content>
                        </Popover>
                        */}
                    </Overlay>
                </td>
            </MixerRow>
        )});
            
        return (
            <div>
            <Module style={this.props.style}>
                <PanelHeader>Mixer</PanelHeader>
                <div style={{ overflow: 'auto', scrollbarWidth: 'none', height: '60px' }}>
                    <table>
                        {insts}
                    </table>
                </div>
            </Module>

            </div>
        );
    };
};

export default Mixer;
