import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import styled from 'styled-components';
import uuidv4 from 'uuid/v4';
import midi from './Audio/midi';
import audio from './Audio/index';

// logos
import github from './static/GitHub-Mark-32px.png';
import twitter from './static/Twitter_Logo_WhiteOnImage.svg';

import { MeasureCalc, order_by_key } from './Util/index';
import UI from './Components/Canvas';
import { FormInput, Insert, Ext, Footer, Log, Rehearsal, Metadata, Upload, Playback, Panel, Pane, AudioButton, InstName, TBToggle, TBDropdown } from './Components/Styled';
import { SettingsModal, WarningModal } from './Components/Modals';

import CONFIG from './config/CONFIG.json';

const DEBUG = true;


const PPQ_OPTIONS = CONFIG.PPQ_OPTIONS.map(o => ({ PPQ_tempo: o[0], PPQ_desc: o[1] }));
// later do custom PPQs

var calcRange = (measures) => {
    let tempo = [];
    let span = [];
    Object.keys(measures).forEach((key) => {
        tempo.push(measures[key].start);
        tempo.push(measures[key].end);
        span.push(measures[key].offset);
        span.push(measures[key].offset + measures[key].ms);
    });
    return {
        tempo: [Math.min(...tempo), Math.max(...tempo)],
        span: [Math.min(...span), Math.max(...span)],
    };
};

var timeToChrono = (time) => {
    let chrono = [parseInt(Math.abs(time / 3600000), 10)];
    chrono = chrono.concat([60000, 1000].map((num) =>
        parseInt(Math.abs(time / num), 10).toString().padStart(2, "0")))
            .join(':');
    chrono += '.' + parseInt(Math.abs(time % 1000), 10).toString().padStart(3, "0");
    if (time < 0.0)
       chrono = '-' + chrono;
    return chrono;
};



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
          isPlaying: false,
          tracking: 0,
          locks: [],
          mode: 0,
          PPQ: CONFIG.PPQ_default
      }

      Object.assign(this.state, PPQ_OPTIONS[1]);
      ['start', 'end', 'beats', 'offset'].forEach(n => this.state[n] = '');

      // subscribe to audio updates
      audio.subscribe((e) => this.setState(oldState => ({ tracking: e.tracking })));

      this.state.PPQ_mod = this.state.PPQ / this.state.PPQ_tempo;

      let ids = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];
      this.state.instruments.push(DEBUG ?
          {
              name: 'default',
              measures: {
                  [ids[0]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 12000
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[0] },

                  [ids[1]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 6,
                      offset: 500
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[1] },
                  [ids[2]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 4722
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[2] },
              }
          } :
          { measures: {} });
          
      DEBUG ? this.state.instruments.push({
              name: 'asdf',
              measures: {
                  [ids[3]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 12000
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[3] },

                  [ids[4]]: { ...MeasureCalc({ 
                      start: 144,
                      end: 72,
                      timesig: 7,
                      offset: 300
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[4] },
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
      this.upload = this.upload.bind(this);
      this.reset = this.reset.bind(this);
      this.settings = this.settings.bind(this);
      this.handleNew = this.handleNew.bind(this);
      this.handleOpen = this.handleOpen.bind(this);
      this.inputs = {};


      this.API = this.initAPI()

  }

  initAPI() {
      var self = this;
    
      var select = (inst, meas) => self.setState(oldState => ({selected: {inst: inst, measure: meas}}));

      var get = (name) => {
          if (name === 'isPlaying')
            return self.state.isPlaying;
      };

      var updateMeasure = (inst, id, start, end, timesig, offset) => {
          offset = offset || this.state.instruments[inst].measures[id].offset;
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
          self.setState(oldState => {
              let instruments = oldState.instruments;
              instruments[inst].measures[id] = { ...calc, id };
              return { instruments };
          });
      };

      var deleteMeasure = (selected) => self.setState(oldState => {
          delete oldState.instruments[selected.inst].measures[selected.meas];
          console.log(oldState.instruments[selected.inst].measures);
          return ({ instruments: oldState.instruments });
      });

      var displaySelected = (selected) => self.setState(oldState => ({ selected }));

      var newScaling = (scale) => self.setState(oldState => ({sizing: 600.0 / scale}));
      var newCursor = (loc) => self.setState(oldState => ({ cursor: loc }));

      var paste = (inst, measure, offset) => {
          var calc = MeasureCalc({ start: measure.start, end: measure.end, timesig: measure.beats.length - 1, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
          self.setState(oldState => {
              let instruments = oldState.instruments;
              let id = uuidv4();
              instruments[inst].measures[id] = { ...calc, id };
              return { instruments };
          });
      };

      var play = (cursor) => {
          this.play(!this.state.isPlaying, cursor ? cursor : 0);
      };

      var exposeTracking = () => ({
          context: audio.context,
          locator: audio.locator
      });

      var updateMode = (mode) => this.setState({ mode });

      return { get, select, deleteMeasure, updateMeasure, newScaling, newCursor, displaySelected, paste, play, exposeTracking, updateMode };
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
          oldState.newInst = false;
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
          let id = uuidv4();
          instruments[inst].measures[id] = { ...calc, id };
          return { instruments };
      });
  };

  handleLock(val, e) {
      this.setState(oldState => ({ locks: val }));
  };

  handleMuting(val, e, ind) {
      (val.indexOf('mute') > -1) ?
          audio.mute(ind, true) : audio.mute(ind, false);
      if (val.indexOf('solo') > -1)
          this.state.instruments.forEach((inst, i) =>
              audio.mute(i, (i === ind) ? false : true));
  };

  // filter all non-numbers
  handleInput(e) {
      if (e.target.value === '' || /^[0-9\b]+$/.test(e.target.value))
          this.setState({ [e.target.name]: e.target.value });
  };

  handleTempoPPQ(eventKey) {
      document.activeElement.blur();
      let new_PPQ = PPQ_OPTIONS[eventKey];
      this.setState(oldState => new_PPQ);
  };

  handlePPQ(eventKey, e) {
    document.activeElement.blur();

    // DEPRECATED, GET THIS WORKING AGAIN
    let tempo_ppqs = PPQ_OPTIONS.reduce((acc, ppq, ind) => {
        console.log(ppq.PPQ_tempo);
        console.log(eventKey % ppq.PPQ_tempo);
        return (eventKey % ppq.PPQ_tempo) ?
            acc :
            [...acc, { eventKey: ind, text: `${ppq.PPQ_tempo} (${ppq.PPQ_desc})`} ]},
        []);
    this.setState(oldState => ({ PPQ: eventKey }));
  };

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

          let rest = `T${this.state.PPQ - 1}`;

          let beats = [];
          let tempi = order_by_key(inst.measures, 'offset').reduce((acc, key, ind) => {
              let meas = inst.measures[key];
              // push empty message if within delta threshold
              let delta = this.state.PPQ - 1;
              if (last) {
                  if (meas.offset - (last.offset + last.ms) > CONFIG.DELTA_THRESHOLD) {
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

              let new_tick = {};
              let new_beat = { duration: 'T1', pitch: ['C4'] };

              let ticks = [{ ...new_tick, tempo: meas.start, timesig: meas.timesig }];
              beats.push({ ...new_beat, wait });

              meas.ticks.forEach((_, i) => {
                  if (i === 0)
                      return;
                  if (!(i % this.state.PPQ_mod)) {
                      if (!(i % (meas.ticks.length / meas.timesig)))
                          beats.push({ ...new_beat, wait: rest });
                      ticks.push({ ...new_tick, tempo: meas.start + i * slope });
                  };
              });


              // OLD, WORKING
              /*meas.ticks.forEach((_, i) => {
                  // check for tempo change
                  if (!(i % this.state.PPQ_mod)) {
                      let tick = { ...new_tick, tempo: meas.start + i * slope };
                      // check for metronome tick
                      if (!(i % (meas.ticks.length / meas.timesig))) {
                          if (i == 0)
                              tick.timesig = meas.timesig;
                          beats.push({ 
                              ...new_beat, 
                              wait: (i === 0) ? offset : rest
                          });
                      };
                      ticks.push(tick);
                  };
              });
              */
              
              // get this a little more foolproof later

              return acc.concat(ticks);
          }, []);
          
          beats.push({ duration: '4', pitch: ['C4'], wait: rest });
          tempi.push({ tempo: last.end });
          return ({ tempi, beats, name: inst.name });
      });
      
      midi(tracks, this.state.PPQ, this.state.PPQ_tempo);

  };

  play(isPlaying, cursor) {
      if (!isPlaying)
          audio.kill()
      else {
          audio.play(isPlaying, 
              this.state.instruments.map((inst, ind) =>
              [ind, Object.keys(inst.measures).reduce((m_acc, meas) => 
                  [ ...m_acc, ...inst.measures[meas].beats.map((beat) => beat + inst.measures[meas].offset) ]
              , [])])
          , cursor);
      };
      document.activeElement.blur();
      this.setState(oldState => ({ isPlaying }));
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

  upload(e) {
      if (this.state.instruments.length > 1
          || Object.keys(this.state.instruments[0].measures).length)
          this.setState({ warningOpen: true })
      else
          document.getElementById('dummyLoad').click();
  }

  handleNew(e) {
      this.setState({ instruments:
          [{
              name: 'default',
              measures: {}
          }],
          warningNew: false,
      });
  }

  handleOpen(e) {
      document.getElementById('dummyLoad').click();
      this.setState({ warningOpen: false });
  }

  reset(e) {
      this.setState({ warningNew: true });
  }

  settings(e) {
      this.setState(oldState => ({ settingsOpen: !oldState.settingsOpen }));
  }

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

                      let id = uuidv4();
                      acc[params[0]].measures[id] = { ...newMeas, id };
                      return acc;
                  }, [])
          });


      reader.readAsText(e.target.files[0]);
  };


  render() {
    let CONSTANTS = {
      PPQ: this.state.PPQ,
      PPQ_tempo: this.state.PPQ_tempo,
      range: calcRange(
          this.state.instruments.reduce((acc, inst) => ({ ...acc, ...(inst.measures) }), {})
      )
    };

    var newInstruments = this.state.instruments.map((inst) => ({ 
        measures: Object.assign({}, inst.measures), 
        name: inst.name
    }));

    var cursor = timeToChrono(this.state.cursor);
    
    let measure_inputs = ['start', 'end', 'beats', 'offset'].map((name) => 
        <FormInput
            type="text"
            key={name}
            value={this.state[name]}
            placeholder={name}
            name={name}
            onChange={this.handleInput}
        />
            
   );


    let pad = CONFIG.CANVAS_PADDING;
    let panes = this.state.instruments.map((inst, ind) => {
        let top = ind*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT;
        return (<Pane className="pane" key={ind} x={pad} y={top} height={CONFIG.TRACK_HEIGHT}>
            <AudioButton x={0} y={0} onClick={(val, e) => this.handleMuting(val, e, ind)} value="true">mute</AudioButton>
            <AudioButton x={0} y={CONFIG.INST_HEIGHT/3} onChange={(val, e) => this.handleMuting(val, e, ind)} value="false">solo</AudioButton>
        </Pane>
    )}).concat(this.state.newInst ? 
        (<form onSubmit={this.handleInst} className="inst-form">
            <label>new instrument</label>
            <input
                type="text"
                name="instName"
                onChange={this.handleInput}
            ></input>
            <button type="submit">new inst</button>
        </form>) :
        (<Pane className="pane align-middle" x={pad} y={this.state.instruments.length*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT} key={this.state.instruments.length}>
            <button onClick={() => this.setState({ newInst: true })}>&#x2795;</button>
        </Pane>)
    );
        
    //tempo_ppqs.forEach((p) => console.log(p));
      //

    let modalButtons = ['Close', 'Save changes'].map((name, ind) => (<Upload key={ind}>{name}</Upload>));

    let selected = this.state.selected;

    let inst = selected.inst > -1 ?
        this.state.instruments[selected.inst] :
        {};

    let meas = selected.meas !== -1 ?
        inst.measures[selected.meas] :
        {};

    let data = [];
    if (selected.inst > -1)
        data.push(<span>{ inst.name }</span>);
    if (selected.meas !== -1)
        data.push(<span> : {meas.start} - {meas.end} / {meas.timesig}</span>);
      
    let metadata = (<Metadata x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={window.innerHeight - CONFIG.META_HEIGHT - CONFIG.LOG_HEIGHT}>
        { data }
        <p id="sizing">View: {(this.state.sizing/1000).toFixed(2)}"</p>
      </Metadata>);

    return (
      <div className="App" style={{ 'backgroundColor': CONFIG.secondary }}>
        <Playback x={600} y={0} status={this.state.isPlaying.toString()} onClick={() => this.play(!this.state.isPlaying, 0)}>&#x262D;</Playback>
        <div style={{ margin: '0px'}}>

          {/* left midi controls */}
          <Panel>
              {panes}
          </Panel>
          
          <UI locks={this.state.locks} instruments={newInstruments} API={this.API} CONSTANTS={CONSTANTS}/>

          {/* right toolbar controls */}
          <Rehearsal x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={CONFIG.PLAYBACK_HEIGHT}>
            rehearsal
          </Rehearsal>
          { metadata }
          <Log x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={window.innerHeight - CONFIG.LOG_HEIGHT - CONFIG.TRACKING_HEIGHT}>
            log
          </Log>

          {/* modes */}
            { this.state.mode === 1 ? 
                <Insert left={(window.innerWidth - CONFIG.TOOLBAR_WIDTH + CONFIG.CANVAS_PADDING) / 3 }>
                    <form onSubmit={this.handleMeasure} className="measure-form">
                        {measure_inputs}
                        <button type="submit" disabled={this.state.selected.inst === -1}>&#x219D;</button>
                    </form>
                </Insert>
            : null }


          {/* footer */}
          <Footer>
            <h1 className="flavor" style={{ display: 'inline-block' }}>BANDIT</h1>
            <Ext target="_blank" href="https://github.com/ultraturtle0/timebandit"><img className="qlink" style={{ position: 'relative', bottom: '5px', width: '16px' }} src={github}/></Ext>
        
            <Ext target="_blank" href="https://twitter.com/j_kusel"><img className="qlink" style={{ position: 'relative', bottom: '5px', width: '22px' }} src={twitter}/></Ext>
          </Footer>
          <div>
            <Upload onClick={this.settings}>settings</Upload>
            <Upload onClick={this.reset}>new</Upload>
            <Upload onClick={this.upload}>open</Upload>
            <Upload onClick={this.save}>save</Upload>
            <Upload onClick={this.midi}>export</Upload>
            <div type="checkbox" onChange={this.handleLock} className="mb-2">
                { ['start', 'end', 'direction', 'slope', 'length'].map((button, index) =>
                    <TBToggle className="shadow-none" key={button} value={index + 1}>{button}</TBToggle>) }
            </div>
          </div>
        </div>

        <form>
            <input id="dummyLoad" type="file" name="file" onChange={this.load} hidden />
        </form>

        <WarningModal
          show={this.state.warningNew}
          onHide={() => this.setState({ warningNew: false })}
          body={<p>Close without saving?</p>}
          buttons={[
              { onClick: this.save, text: 'save' },
              { onClick: this.handleNew, text: 'new file' }
          ]}
        />        
        <WarningModal
          show={this.state.warningOpen}
          onHide={() => this.setState({ warningOpen: false })}
          body={<p>Close without saving?</p>}
          buttons={[
              { onClick: this.open, text: 'save' },
              { onClick: this.handleOpen, text: 'open file...' }
          ]}

        />        
        <SettingsModal
            show={this.state.settingsOpen}
            onHideCallback={this.settings}
            onTempoSelect={this.handleTempoPPQ}
            onPPQSelect={this.handlePPQ}
            settings={({
                PPQ_tempo: this.state.PPQ_tempo,
                PPQ_desc: this.state.PPQ_desc,
                PPQ: this.state.PPQ,
            })}
        />

      </div>
    );
  }
}

export default App;
