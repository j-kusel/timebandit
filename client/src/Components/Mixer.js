import React, { Component } from 'react';
import styled from 'styled-components';
import { primary } from '../config/CONFIG.json';
import { FormInput, Slider } from './Styled';
import { MixerRow, MixerArrow, MixerButton } from './Styled';
import { PanelHeader } from './Styled';

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
            mutes: props.insts.map(__ => false),
            solos: props.insts.map(__ => false),
            volumes: props.insts.map(__ => 80),
            volShows: -1
        }
        
        this.handleMute = this.handleMute.bind(this);
        this.handleSolo = this.handleSolo.bind(this);
        this.handleVolume = this.handleVolume.bind(this);
    }

    static getDerivedStateFromProps(props, state) {
        let defaults = { mutes: false, solos: false, volumes: 80 };
        let newState = Object.keys(defaults).reduce((acc, key) =>
            Object.assign(acc, {[key]: props.insts.map((__, i) =>
                (i < state[key].length) ?
                    state[key][i] : defaults[key]
            )}), {}
        );

        return newState;
    }

    componentWillUpdate(nextProps, nextState) {
        return true;
    }

    /**
     * Toggles items by index in [this.state.mutes]{@link Mixer#state.mutes}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleMute(index) {
        this.props.audio.mute(index, !this.state.mutes[index]);
        this.setState(oldState => {
            let mutes = oldState.mutes;
            mutes[index] = !oldState.mutes[index];
            return ({ mutes });
        });
    }

    /**
     * Solos playback of items by index in [this.state.mutes]{@link Mixer#state}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleSolo(index) {
        this.props.audio.solo(index, !this.state.solos[index]);
        this.setState(oldState => ({
            mutes: oldState.mutes.map(__ => false),
            solos: oldState.solos.map((solo, i) => !solo && i === index)
        }));
    }

    /**
     * Changes instrument metronome volume via [audio.setVolume]{@link audio#setVolume}
     * @memberOf Mixer
     * @param e - [HTMLElement change event]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event}
     * @param {Number} index - Index of target instrument
     */
    handleVolume(e, index) {
        let vol = parseInt(e.target.value, 10);
        this.props.audio.setVolume(index, vol/100.0);
        this.setState(oldState => {
            let volumes = oldState.volumes;
            let volShows = index;
            volumes[index] = vol;
            return ({ volumes, volShows });
        });
    }

    render() {
        let insts = this.props.insts.map((inst, i) => (
            <MixerRow key={i} style={{ fontSize: '8px' }}>
                <td className="arrows" style={{ minWidth: '10px' }}>
                    <MixerArrow onClick={() => this.props.instMove(i, 'up')}>&#9650;</MixerArrow>
                    <MixerArrow onClick={() => this.props.instMove(i, 'down')}>&#9660;</MixerArrow>
                </td>
                <td>{inst.name}</td>
                <td><MixerButton style={{color: this.state.mutes[i] ? 'red' : 'black' }} onClick={() => this.handleMute(i)}>M</MixerButton></td>
                <td><MixerButton style={{color: this.state.solos[i] ? 'blue' : 'black' }} onClick={() => this.handleSolo(i)}>S</MixerButton></td>
                <td><Slider type="range" min="0" max="100" value={this.state.volumes[i]} onChange={(e) => this.handleVolume(e, i)} onMouseUp={() => this.setState({ volShows: -1 })}/></td>
        
                <td>{this.state.volShows === i ? this.state.volumes[i] : null}</td>
            </MixerRow>
        ));
            
        return (
            <div style={this.props.style}>
                <PanelHeader>Mixer</PanelHeader>
                <div style={{ overflow: 'auto', scrollbarWidth: 'none', height: '60px' }}>
                    <table>
                        {insts}
                    </table>
                </div>
            </div>
        );
    };
};

export default Mixer;
