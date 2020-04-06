import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Form } from 'react-bootstrap';
import { Container, Row, Col } from 'react-bootstrap';
import { ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import styled from 'styled-components';
import uuidv4 from 'uuid/v4';
import midi from './Audio/midi';
import audio from './Audio/index';

import { MeasureCalc } from './Util/index';
import UI from './Components/Canvas';



const TRACK_HEIGHT = 100;
const DEBUG = true;
const DELTA_THRESHOLD = 5; // in milliseconds




class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          instruments: [],
          sizing: 600.0,
          cursor: 0.0,
          scroll: 0,
          PPQ: 4,
          time: 0,
          selected: {
              inst: -1,
              meas: -1
          },
          locks: [],
      }

      this.state.instruments.push(DEBUG ?
          {
              name: 'default',
              measures: {
                  [uuidv4()]: MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 6,
                      offset: 500
                  }, { PPQ: this.state.PPQ }),
                  [uuidv4()]: MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 4722
                  }, { PPQ: this.state.PPQ })
              }
          } :
          { measures: {} });
          
      DEBUG ? this.state.instruments.push({
              name: 'asdf',
              measures: {
                  [uuidv4()]: MeasureCalc({ 
                      start: 144,
                      end: 72,
                      timesig: 6,
                      offset: 300
                  }, { PPQ: this.state.PPQ })
              }
          }) : console.log(0);

      this.CONSTANTS = {
          PPQ: this.state.PPQ
      };

      this.sizing = 600.0;
      this.location = 0.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleLock = this.handleLock.bind(this);
      this.handleInput = this.handleInput.bind(this);
      this.midi = this.midi.bind(this);
      this.play = this.play.bind(this);
      this.kill = this.kill.bind(this);
      this.save = this.save.bind(this);
      this.load = this.load.bind(this);
      this.inputs = {};


      this.API = this.initAPI()

  }

  initAPI() {
      var self = this;
    
      var select = (inst, meas) => self.setState(oldState => ({selected: {inst: inst, measure: meas}}));

      var updateMeasure = (inst, id, start, end, timesig, offset) => {
          offset = offset || this.state.instruments[inst].measures[id].offset;
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ });
          self.setState(oldState => {
              let instruments = oldState.instruments;
              instruments[inst].measures[id] = calc;
              return { instruments };
          });
      };

      var displaySelected = (selected) => self.setState(oldState => ({ selected }));

      var newScaling = (scale) => self.setState(oldState => ({sizing: 600.0 / scale}));
      var newCursor = (loc) => self.setState(oldState => ({ cursor: loc }));

      var paste = (inst, measure, offset) => {
          var calc = MeasureCalc({ start: measure.start, end: measure.end, timesig: measure.beats.length - 1, offset}, { PPQ: this.state.PPQ });
          self.setState(oldState => {
              let instruments = oldState.instruments;
              instruments[inst].measures[uuidv4()] = calc;
              return { instruments };
          });
      };

      return { select, updateMeasure, newScaling, newCursor, displaySelected, paste };
  }

  handleInst(e) {
      e.preventDefault();

      let newInst = {
          name: this.state.instName,
          measures: {}
      }


      this.setState((oldState) => {
          // add after selected
          let selected = oldState.selected.inst;
          let loc = (selected === -1) ?
              oldState.instruments.length :
              selected;
          oldState.instruments.splice(loc + 1, 0, newInst);
          return oldState;
      });
  }


  handleMeasure(e) {
      e.preventDefault();
      let inst = this.state.selected.inst;
      
      let newMeasure = {
          start: parseInt(this.state.start, 10),
          end: parseInt(this.state.end, 10),
          timesig: parseInt(this.state.beats, 10),
          offset: parseInt(this.state.offset, 10)
      };

      var calc = MeasureCalc(newMeasure, { PPQ: this.state.PPQ });

      this.setState(oldState => {
          let instruments = oldState.instruments;
          instruments[inst].measures[uuidv4()] = calc;
          return { instruments };
      });
  };

  handleLock(val, e) {

      console.log(val);
      this.setState(oldState => ({ locks: val }));
  };

  handleAudio(val, e, ind) {
      console.log(e);
      console.log(val);
  };

  handleInput(e) {
      this.setState({ [e.target.name]: e.target.value });
  };

  midiDebug() {
      midi(this.state.PPQ);
  }

  midi() {

      let tracks = this.state.instruments.map((inst, i_ind) => {


          // this would be solved by sorting measures on entry
          // looking for gaps between measures
          // lets assume they're in order for now.
          /*let spreads = Object.keys(inst.measures).reduce((acc, key) =>
              [inst.measures[key].offset, inst.measures[key].ms], []);
              */

          // fill gaps with appropriate number of ticks at given BPM
          let last = 0;

          let tpm = 60000.0 / this.state.PPQ;

          let beats = [];
          let map = Object.keys(inst.measures).reduce((acc, key, ind) => {
              let meas = inst.measures[key];
              // push empty message if within delta threshold
              let delta = 0
              if (last) {
                  let d = meas.offset - (last.ms + last.offset);
                  if (d > DELTA_THRESHOLD) {
                      delta = parseInt(delta / (tpm / last.end), 10);
                      acc.push({ delta, tempo: last.end });
                  };
              } else {
                  // or default to ? bpm for initial gap
                  delta = Math.round(meas.offset / (tpm / 300));
                  let tempo = delta/(meas.offset / tpm);
                  acc.push({ delta, tempo });
              };

              let wait = `T${delta}`;
              last = meas;

              let slope = (meas.end - meas.start)/meas.ticks.length;
              let ticks = meas.ticks.map((_, i) => {
                  if (!(i % this.state.PPQ)) {
                      let new_beat = { duration: '4', pitch: ['C4'] };
                      if (i === 0)
                          new_beat.wait = wait;
                      beats.push(new_beat); // kinda meaningless
                  };
                  return ({ tempo: meas.start + i * slope })
              });
              
              // get this a little more foolproof later

              return acc.concat(ticks);
          }, []);
          
          beats.push({ duration: '4', pitch: ['C4'] });
          map.push({ tempo: last.end });
          return ({ tempi: map, beats, name: inst.name });
      });
      
      midi(tracks, this.state.PPQ);

  };

  play() {
      let threads = this.state.instruments.map((inst, ind) =>
          [ind, Object.keys(inst.measures).reduce((m_acc, meas) => 
              [ ...m_acc, ...inst.measures[meas].beats.map((beat) => beat + inst.measures[meas].offset) ]
          , [])]);
      audio.play(threads);
  }

  kill() {
      audio.kill();
  }

  save() {
      let insts = this.state.instruments;
      let rows = [['inst', 'start', 'end', 'timesig', 'offset']];

      Object.keys(insts).forEach((inst) => 
          Object.keys(insts[inst].measures).forEach((meas) => 
              rows.push(
                  [inst].concat(['start', 'end', 'timesig', 'offset']
                      .map((key) => insts[inst].measures[meas][key]))
              )
          )
      );
      
      var downloadLink = document.createElement('a');
      downloadLink.href = encodeURI(`data:text/csv;utf-8,`.concat(rows.join('\n')));
      downloadLink.download = 'filename.csv';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
  };

  load(e) {
      var reader = new FileReader();
      reader.onload = (e) =>
          this.setState({ instruments: 
              e.target.result
                  .split('\n')
                  .slice(1) // remove headers
                  .reduce((acc, line) => {
                      let params = line.split(',');
                      let newMeas = MeasureCalc(
                          ['start', 'end', 'timesig', 'offset']
                              .reduce((obj, key, ind) => ({ ...obj, [key]: parseFloat(params[ind+1], 10) }), {})
                          , { PPQ: this.state.PPQ }
                      );

                      let pad = params[0] - (acc.length - 1);
                      if (pad > 0) {
                          for (let i=0; i<=pad; i++) {
                              acc.push({ measures: {} });
                          }
                      };

                      acc[params[0]].measures[uuidv4()] = newMeas;
                      return acc;
                  }, [])
          });


      reader.readAsText(e.target.files[0]);
  };



  render() {
    var newInstruments = this.state.instruments.map((inst) => ({ 
        measures: Object.assign({}, inst.measures), 
        name: inst.name
    }));

    var cursor = [parseInt(Math.abs(this.state.cursor / 3600000), 10)];
    cursor = cursor.concat([60000, 1000].map((num) =>
        parseInt(Math.abs(this.state.cursor / num), 10).toString().padStart(2, "0")))
        .join(':');
    cursor += '.' + parseInt(Math.abs(this.state.cursor % 1000), 10).toString().padStart(3, "0");
    if (this.state.cursor < 0.0)
       cursor = '-' + cursor;


    
    let measure_inputs = ['start', 'end', 'beats', 'offset'].map((name) => 
        <input
            type="text"
            key={name}
            placeholder={name}
            name={name}
            onChange={this.handleInput}
        ></input>
    );

    let Panel = styled(({ className, children }) => (<Col className={className} xs={2}>{children}</Col>))`
        text-align: center;    
        width: 100%;
        padding: 0px;
    `;

    let Pane = styled.div`
        height: ${TRACK_HEIGHT}px;
        border: 1px solid black;
    `;

    let AudioButton = styled(ToggleButton)`
        display: inline;
        background-color: #FFFFCC;
    `;

    let panes = this.state.instruments.map((inst, ind) => (
        <Pane className="pane" key={ind}>
            <ToggleButtonGroup name={"playback"+ind} onChange={this.handleAudio} type="radio">
                <ToggleButton key={"mute"+ind} value="mute">mute</ToggleButton>
                <ToggleButton key={"solo"+ind} value="solo">solo</ToggleButton>
            </ToggleButtonGroup>
        </Pane>
    ));


    return (
      <div className="App">
        { this.state.selected && <p>inst: { this.state.selected.inst } measure: {this.state.selected.meas} </p> }
        <button onClick={this.save}>save</button>
        <button onClick={this.play}>play</button>
        <button onClick={this.kill}>kill</button>
        <button onClick={this.midi}>midi</button>
        <button onClick={audio.init}>unmute</button>
        <form>
            <input type="file" name="file" onChange={this.load}/>
        </form>
        <form onSubmit={this.handleInst} className="inst-form">
            <label>new instrument</label>
            <input
                type="text"
                name="instName"
                onChange={this.handleInput}
            ></input>
            <Button type="submit">new inst</Button>
        </form>
        <form onSubmit={this.handleMeasure} className="measure-form">
            <label>start tempo</label>
            {measure_inputs}
            <button type="submit" disabled={this.state.selected.inst === -1}>create</button>
        </form>
        <ToggleButtonGroup type="checkbox" onChange={this.handleLock} className="mb-2">
            { ['start', 'end', 'direction', 'slope', 'length'].map((button, index) =>
                <ToggleButton key={button} value={index + 1}>{button}</ToggleButton>) }
        </ToggleButtonGroup>
        <p id="sizing">Viewport time: {(this.state.sizing/1000).toFixed(2)} seconds</p>
        <p id="location">Cursor location: {cursor}</p>
        <Container>
          <Row>
            <Panel>{panes}</Panel>
            <Col xs={10}>
              <UI locks={this.state.locks} instruments={newInstruments} API={this.API} CONSTANTS={this.CONSTANTS}/>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default App;
