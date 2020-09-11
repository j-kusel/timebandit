import React, { Component } from 'react';
import styled from 'styled-components';
import { FormInput, Slider } from './Styled';
import c from '../config/CONFIG.json';
import _ from 'lodash';
import { TBButton } from './Styled';

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
         * @property {string} domain - Hostname of server
         * @property {number} port - Port of server
         * @property {Object} registerSocket - Exposes a socket.io instance to {App}
         * @property {Object} commandQueue - Queues commands for bandit hardware
         * @property {number} sustain - Default buzzer length for bandit hardware
         * @property {Boolean} showModal - Toggles modal for sending commands to server
         */
        this.state = {
            audio: props.audio,
            insts: props.insts,
            mutes: props.insts.map(__ => false),
            solos: props.insts.map(__ => false),
            volumes: props.insts.map(__ => 80)
        }

        
        this.handleMute = this.handleMute.bind(this);
        this.handleSolo = this.handleSolo.bind(this);
        this.handleVolume = this.handleVolume.bind(this);
    }

    shouldComponentUpdate(nextProps, nextState) {
        console.log(nextState.volumes);
        return true;
    }

    /**
     * Toggles items by index in [this.state.mutes]{@link Mixer#state.mutes}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleMute(index) {
        this.state.audio.mute(index, !this.state.mutes[index]);
        this.setState(oldState => {
            let mutes = oldState.mutes;
            mutes[index] = !oldState.mutes[index];
            return ({ mutes });
        });
    }

    /**
     * Solos playback of items by index in [this.state.mutes]{@link Mixer#state.mutes}
     * @memberOf Mixer 
     * @param {Number} index - index of target instrument
     */
    handleSolo(index) {
        this.state.audio.solo(index, !this.state.solos[index]);
        this.setState(oldState => ({
            mutes: oldState.mutes.map(__ => false),
            solos: oldState.solos.map((solo, i) => !solo && i === index)
        }));
    }

    handleVolume(e, index) {
        let vol = parseInt(e.target.value, 10);
        this.state.audio.setVolume(index, vol/100.0);
        this.setState(oldState => {
            let volumes = oldState.volumes;
            volumes[index] = vol;
            return ({ volumes });
        });
    }

    render() {
        let insts = this.state.insts.map((inst, i) => (
            <tr key={i} style={{ fontSize: '8px' }}>
                <td>{inst.name}</td>
                <td><button style={{color: this.state.mutes[i] ? 'red' : 'black' }} onClick={() => this.handleMute(i)}>M</button></td>
                <td><button style={{color: this.state.solos[i] ? 'blue' : 'black' }} onClick={() => this.handleSolo(i)}>S</button></td>
                <td><Slider type="range" min="0" max="100" value={this.state.volumes[i]} onChange={(e) => this.handleVolume(e, i)}/></td>
                <td>{this.state.volumes[i]}</td>
            </tr>
        ));
            
        return (
            <div style={this.props.style}>
                <h3 style={{fontSize: '10px'}}>Hello</h3>
                <table>
                    {insts}
                </table>
           
            </div>
        );
    };
};

export default Mixer;
