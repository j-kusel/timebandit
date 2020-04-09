import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Dropdown } from 'react-bootstrap';
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
const PPQ_default = 4;


const PPQ_OPTIONS = [
    [24, 'default'],
    [4, 'ableton live'],
    [256, 'sibelius'],
    [480, 'digital performer'],
    [960, 'reaper'],
    [1024, 'finale']
].map(o => ({ PPQ_tempo: o[0], PPQ_desc: o[1] }));



// later do custom PPQs

var tempo_ppqs = PPQ_OPTIONS.map((ppq, ind) => <Dropdown.Item key={ind} eventKey={ind}>{ppq.PPQ_tempo} ({ppq.PPQ_desc})</Dropdown.Item>);

var Panel = styled(({ className, children }) => (<Col className={className} xs={2}>{children}</Col>))`
    text-align: center;    
    width: 100%;
    padding: 0px;
`;

var Pane = styled.div`
    height: ${TRACK_HEIGHT}px;
    border: 1px solid black;
`;

var AudioButton = styled(ToggleButton)`
    display: inline;
    border: 1px solid black;
    border-radius: 2px;
    background-color: #FFFFCC;
`;

var InstName = styled.h3`
    color: red;
`;




class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          instruments: [],
          sizing: 600.0,
          cursor: 0.0,
          scroll: 0,
          time: 0,
          selected: {
              inst: -1,
              meas: -1
          },
          locks: [],
          PPQ: PPQ_default
      }

      Object.assign(this.state, PPQ_OPTIONS[1]);

      this.state.PPQ_mod = this.state.PPQ / this.state.PPQ_tempo;

      this.state.instruments.push(DEBUG ?
          {
              name: 'default',
              measures: {
                  [uuidv4()]: MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 6,
                      offset: 500
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }),
                  [uuidv4()]: MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 4722
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }),
              }
          } :
          { measures: {} });
          
      DEBUG ? this.state.instruments.push({
              name: 'asdf',
              measures: {
                  [uuidv4()]: MeasureCalc({ 
                      start: 144,
                      end: 72,
                      timesig: 7,
                      offset: 300
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }),
              }
          }) : console.log(0);

      
      this.sizing = 600.0;
      this.location = 0.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleLock = this.handleLock.bind(this);
      this.handleInput = this.handleInput.bind(this);
      this.handlePPQ = this.handlePPQ.bind(this);
      this.handleTempoPPQ = this.handleTempoPPQ.bind(this);
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
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
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
          var calc = MeasureCalc({ start: measure.start, end: measure.end, timesig: measure.beats.length - 1, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
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

      var calc = MeasureCalc(newMeasure, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

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

  handleMuting(val, e, ind) {
      (val.indexOf('mute') > -1) ?
          audio.mute(ind, true) : audio.mute(ind, false);
      if (val.indexOf('solo') > -1)
          this.state.instruments.forEach((inst, i) =>
              audio.mute(i, (i === ind) ? false : true));
  };

  handleInput(e) {
      this.setState({ [e.target.name]: e.target.value });
  };

  handleTempoPPQ(eventKey) {
      let new_PPQ = PPQ_OPTIONS[eventKey];
      this.setState(oldState => new_PPQ);
  };

  handlePPQ(eventKey) {
    tempo_ppqs = PPQ_OPTIONS.reduce((acc, ppq, ind) => {
        console.log(ppq.PPQ_tempo);
        console.log(eventKey % ppq.PPQ_tempo);
        return (eventKey % ppq.PPQ_tempo) ?
            acc :
            [...acc, <Dropdown.Item key={ind} eventKey={ind}>{ppq.PPQ_tempo} ({ppq.PPQ_desc})</Dropdown.Item>]},
        []);
    this.setState(oldState => ({ PPQ: eventKey }));
  };

  midiDebug() {
      midi(this.state.PPQ_tempo);
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

          let tpm = 60000.0 / this.state.PPQ_tempo;

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
                  let new_tick = { tempo: meas.start + i * slope };
                  if (!(i % this.state.PPQ_tempo)) {
                      let new_beat = { duration: '4', pitch: ['C4'] };
                      if (i === 0) {
                          new_tick.timesig = meas.timesig;
                          new_beat.wait = wait;
                      };
                      beats.push(new_beat); // kinda meaningless
                  };
                  return new_tick;
              });
              
              // get this a little more foolproof later

              return acc.concat(ticks);
          }, []);
          
          beats.push({ duration: '4', pitch: ['C4'] });
          map.push({ tempo: last.end });
          return ({ tempi: map, beats, name: inst.name });
      });
      
      midi(tracks, this.state.PPQ_tempo);

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
                          , { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
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
    let CONSTANTS = {
      PPQ: this.state.PPQ,
      PPQ_tempo: this.state.PPQ_tempo
    };

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


    let panes = this.state.instruments.map((inst, ind) => (
        <Pane className="pane" key={ind}>
            <ToggleButtonGroup name={"playback"+ind} onChange={(val, e) => this.handleMuting(val, e, ind)} type="checkbox">
                <InstName>{inst.name}</InstName>
                <hr></hr>
                <AudioButton value="mute">mute</AudioButton>
                <AudioButton value="solo">solo</AudioButton>
            </ToggleButtonGroup>
        </Pane>
    ));

    //tempo_ppqs.forEach((p) => console.log(p));


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
        <Dropdown onSelect={this.handlePPQ}>
          <Dropdown.Toggle>
            PPQ: {this.state.PPQ}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item eventKey={256}>256</Dropdown.Item>
            <Dropdown.Item eventKey={96}>96</Dropdown.Item>
            <Dropdown.Item eventKey={24}>24</Dropdown.Item>


          </Dropdown.Menu>
        </Dropdown>
        <Dropdown onSelect={this.handleTempoPPQ}>
          <Dropdown.Toggle>
            Tempo PPQ: {this.state.PPQ_tempo} ({this.state.PPQ_desc})
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {tempo_ppqs}
          </Dropdown.Menu>
        </Dropdown>
        <Container>
          <Row>
            <Panel>{panes}</Panel>
            <Col xs={10}>
              <UI locks={this.state.locks} instruments={newInstruments} API={this.API} CONSTANTS={CONSTANTS}/>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default App;
