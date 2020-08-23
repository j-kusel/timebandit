import React, { Component } from 'react';
import _ from 'lodash';
import 'bootstrap/dist/css/bootstrap.min.css';
import uuidv4 from 'uuid/v4';
import midi from './Audio/midi';
import audio from './Audio/audio';

// logos
import github from './static/GitHub-Mark-32px.png';
import twitter from './static/Twitter_Logo_WhiteOnImage.svg';

import { MeasureCalc, order_by_key } from './Util/index';
import ordered from './Util/ordered';
import logger from './Util/logger';
import UI from './Components/Canvas';
import { NewInst, FormInput, TrackingBar, Insert, Edit, Ext, Footer, Upload, Submit, Playback, Panel, Pane, AudioButton, Lock } from './Components/Styled';
//import { Log, Metadata, Rehearsal } from './Components/Styled';
import { SettingsModal, WarningModal, TutorialsModal, WelcomeModal } from './Components/Modals';

import CONFIG from './config/CONFIG.json';
import socketIOClient from 'socket.io-client';

const DEBUG = process.env.NODE_ENV === 'development';

const socket = socketIOClient('http://localhost:3001');
socket.on('hello', (data) => {
    socket.emit('frame', 0b00000001);
    socket.emit('loopback', 'stfu');
});

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

// might be deprecated
/*var timeToChrono = (time) => {
    let chrono = [parseInt(Math.abs(time / 3600000), 10)];
    chrono = chrono.concat([60000, 1000].map((num) =>
        parseInt(Math.abs(time / num), 10).toString().padStart(2, "0")))
            .join(':');
    chrono += '.' + parseInt(Math.abs(time % 1000), 10).toString().padStart(3, "0");
    if (time < 0.0)
       chrono = '-' + chrono;
    return chrono;
};*/



class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          instruments: [/*{
              name: 'default',
              measures: {}
          }*/],
          ordered: {},
          sizing: 600.0,
          cursor: 0.0,
          start: '',
          end: '',
          timesig: '',
          edit_start: '',
          edit_end: '',
          edit_timesig: '',
          offset: '',
          instName: '',
          temp_offset: '',
          scale: 1,
          viewport: 0,
          time: 0,
          selected: { },
          isPlaying: false,
          isPreviewing: false,
          keysDisabled: false,
          previewMeasure: {},
          insertMeas: {},
          editMeas: {},
          insertInst: -1,
          tracking: 0,
          locks: [],
          mode: 0,
          newInst: false,
          PPQ: CONFIG.PPQ_default,
          tutorial_triggers: {}
      };

      ['insertFocusStart', 'insertFocusEnd', 'insertFocusTimesig', 'instNameFocus'].forEach(ref => this[ref] = React.createRef());

      Object.assign(this.state, PPQ_OPTIONS[1]);

      // subscribe to audio updates
      audio.subscribe((e) => this.setState(oldState => ({ tracking: e.tracking })));
      // hook into buzzer
      audio.schedulerHook((data) => {
      });
      audio.triggerHook((inst) => {
          socket.emit('schedule', inst.reduce((acc, i) => acc |= (1 << i), 0b00000000));
      });

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
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[0], inst: this.state.instruments.length },

                  [ids[1]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 6,
                      offset: 500
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[1], inst: this.state.instruments.length },
                  [ids[2]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 4722
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[2], inst: this.state.instruments.length },
              }
          } :
          { name: 'default', measures: {} });
          
      if (DEBUG)
          this.state.instruments.push({
              name: 'asdf',
              measures: {
                  [ids[3]]: { ...MeasureCalc({ 
                      start: 60,
                      end: 120,
                      timesig: 5,
                      offset: 12000
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[3], inst: this.state.instruments.length },

                  /*[ids[4]]: { ...MeasureCalc({ 
                      start: 144,
                      end: 72,
                      timesig: 7,
                      offset: 300
                  }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }), id: ids[4] },
                  */
              }
          });

      
      this.sizing = 600.0;
      this.location = 0.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleTut = this.handleTut.bind(this);
      this.instOpen = this.instOpen.bind(this);
      this.instClose = this.instClose.bind(this);
      this.handleLock = this.handleLock.bind(this);
      this.handleNumInput = this.handleNumInput.bind(this);
      this.handleNumEdit = this.handleNumEdit.bind(this);
      this.handleNameInput = this.handleNameInput.bind(this);
      this.handleOffset = this.handleOffset.bind(this);
      this.handlePPQ = this.handlePPQ.bind(this);
      this.handleTempoPPQ = this.handleTempoPPQ.bind(this);
      this.midi = this.midi.bind(this);
      this.play = this.play.bind(this);
      this.preview = this.preview.bind(this);
      this.kill = this.kill.bind(this);
      this.save = this.save.bind(this);
      this.load = this.load.bind(this);
      this.upload = this.upload.bind(this);
      this.reset = this.reset.bind(this);
      this.settings = this.settings.bind(this);
      this.tutorials = this.tutorials.bind(this);
      this.handleNew = this.handleNew.bind(this);
      this.handleOpen = this.handleOpen.bind(this);
      this.confirmEdit = this.confirmEdit.bind(this);
      this.inputs = {};


      this.API = this.initAPI()

  }

  initAPI() {
      var self = this;

    
      var get = (name) => {
          if (name === 'isPlaying')
            return self.state.isPlaying;
      };

      var registerTuts = (obj) => {
          let tutorial_triggers = {}
          Object.keys(obj).forEach(tut => 
              tutorial_triggers[tut] = obj[tut]
          );
          this.setState({ tutorial_triggers });
      }

      var updateMeasure = (inst, id, start, end, timesig, offset) => {
          logger.log(`Updating measure ${id} in instrument ${inst}.`);  
          let oldMeas = this.state.instruments[inst].measures[id].offset;

          offset = offset || oldMeas;
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

          // re-order measures
          self.setState(oldState => {
              let instruments = oldState.instruments;
              let oldMeas = instruments[inst].measures[id];
              let newMeas = { ...calc, id, inst, beat_nodes: [] };
              let ordered_cpy = Object.assign(oldState.ordered, {});
              if (Object.keys(ordered_cpy))
                  calc.beats.forEach((beat, ind) =>
                      ordered.tree.edit(ordered_cpy, {
                          inst,
                          newMeas,
                          _clear: oldMeas.beats[ind] + oldMeas.offset,
                          _target: beat + offset
                      })
                  );

              instruments[inst].measures[id] = newMeas;
              return { instruments, ordered: ordered_cpy };
          });
      };

      var deleteMeasure = (selected) => self.setState(oldState => {
          logger.log(`Deleting measure ${selected.meas.id} from instrument ${selected.inst}.`);
          let ordered_cpy = oldState.ordered;
          if (Object.keys(ordered_cpy)) {
              let meas_to_delete = oldState.instruments[selected.inst].measures[selected.meas.id];
              meas_to_delete
                  .beats.forEach((beat, ind) => {
                      // IN PROGRESS
                      /*
                      let find = (node, { _clear }) => {
                          console.log(_clear);
                          if (node === undefined)
                              return;
                          if (Math.abs(node.loc - _clear) < 5) {
                              console.log('finding it here');
                              //node.meas = node.meas.filter(meas => meas.inst !== selected.inst);
                              node.meas.splice(node.meas.indexOf(selected.inst));
                              
                              // NEED TO REPLACE NODE
                          }
                          (_clear < node.loc) ?
                              find(node.left, { _clear }) :
                              find(node.right, { _clear });
                      }
                      */

                      ordered.tree.edit(ordered_cpy, { _clear: beat + meas_to_delete.offset, inst: selected.inst });
                  });
          }

          delete oldState.instruments[selected.inst].measures[selected.meas.id];
          return ({ instruments: oldState.instruments, selected: {}, ordered: ordered_cpy });
      });

      var displaySelected = (selected) => {
          let newState = {
              selected,
              editMeas: {}
          };
          
          if (selected.meas)
              Object.assign(newState, {
                  edit_start: selected.meas.start,
                  edit_end: selected.meas.end,
                  edit_timesig: selected.meas.timesig
              });

          console.log(newState);
          self.setState(oldState => newState);
          
      };

      var newFile = () =>
          self.setState({
              selected: { inst: -1, meas: undefined },
              instruments: []
          });

      var newScaling = (scale) => self.setState(oldState => ({sizing: 600.0 / scale}));
      var newCursor = (loc) => self.setState(oldState => ({ cursor: loc }));

      var paste = (inst, measure, offset) => {
          logger.log(`Pasting copied measure ${measure.id} into instrument ${inst}...`);
          var calc = MeasureCalc({ start: measure.start, end: measure.end, timesig: measure.beats.length - 1, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
          self.setState(oldState => {
              let instruments = oldState.instruments;
              let id = uuidv4();
              instruments[inst].measures[id] = { ...calc, id, inst };
              logger.log(`New measure ${id} created in instrument ${inst}.`);
              return { instruments };
          });
      };

      var play = (cursor) => {
          logger.log(`Starting playback at ${cursor}ms.`);
          this.play(!this.state.isPlaying, cursor ? cursor : 0);
      };

      var preview = (cursor) => {
          this.preview(!this.state.isPreviewing);
      };

      var exposeTracking = () => ({
          context: audio.context,
          locator: audio.locator
      });

      // makes sure menus aren't in use when pressing keys
      var checkFocus = () =>
          [this.insertFocusStart, this.insertFocusEnd, this.insertFocusTimesig]
              .reduce((acc, ref) => {
                  if (!document.activeElement || !ref.current)
                      return acc;
                  return (acc || ref.current.id === document.activeElement.id);
              }, false); 

      var toggleInst = (open) =>
          open ?
              this.instClose() :
              this.instOpen();
              
      var updateMode = (mode, options) => {
          logger.log(`Entering mode ${mode}.`);
          let newState = { mode };
          if (mode === 1) {
            this.setState(newState);
            this.insertFocusStart.current.focus();
          } else {
              newState.insertMeas = {};
              if (mode === 2) {
                //['start', 'end', 'timesig'].forEach(x => newState['edit_'.concat(x)] = this.selected.meas[x]);
              }
              else {
                  ['start', 'end', 'timesig', 'offset'].forEach(x => {
                      newState[x] = '';
                      newState['edit_'.concat(x)] = '';
                  });
                  newState.temp_offset = false;
                  newState.editMeas = {};
              }
              this.setState(newState);
          };
      };

      var pollSelecting = () => (!!this.state.temp_offset);
      var confirmSelecting = (inst) => {
          this.setState({ offset: this.state.cursor, temp_offset: false, insertInst: inst });
          return this.state.cursor;
      };

      var reportWindow = (viewport, scale) => this.setState({ viewport, scale });

      var disableKeys = () => this.state.keysDisabled;

      var updateEdit = (s, e, ts, off) => this.setState({
          edit_start: s,
          edit_end: e,
          edit_timesig: ts,
      });

      var newInstrument = (name) =>
          this.setState(oldState => {
              let instruments = oldState.instruments;
              instruments.push({ name, measures: {}});
              return ({ instruments });
          });


      var newMeasure = (inst, start, end, timesig, offset) => {
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

          let id = uuidv4();
          let measure = { ...calc, id, inst };
          
          let newState = { instruments: this.state.instruments };
          newState.instruments[inst].measures[id] = measure;

          this.setState(newState);
          return measure;
      };

      return { registerTuts, newFile, newInstrument, newMeasure, toggleInst, pollSelecting, confirmSelecting, get, deleteMeasure, updateMeasure, newScaling, newCursor, displaySelected, paste, play, preview, exposeTracking, updateMode, reportWindow, disableKeys, updateEdit, checkFocus };
  }

  instOpen(e) {
      this.setState(() => ({ newInst: true }), () => this.instNameFocus.current.focus());
  };

  instClose(e) {
      this.setState({ newInst: false });
  };

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
          logger.log(`Adding new instrument in slot ${loc}.`);
          return oldState;
      });
  }


  handleMeasure(e) {
      e.preventDefault();
      console.log(this.state.selected.inst);
      console.log(this.state.insertInst);
      if (this.state.selected.inst === undefined) {
          alert('select an instrument first!');
          return;
      }
           
      let inst = (this.state.insertInst >= 0) ?
          this.state.insertInst : this.state.selected.inst;
      
      let selected = this.state.selected.meas;
      let newMeasure = {
          start: parseInt(this.state.start, 10),
          end: parseInt(this.state.end, 10),
          timesig: parseInt(this.state.timesig, 10),
          offset: this.state.offset ? parseInt(this.state.offset, 10) : selected.ms + selected.offset,
      };

      var calc = MeasureCalc(newMeasure, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

      this.setState(oldState => {
          let instruments = oldState.instruments;
          let id = uuidv4();
          instruments[inst].measures[id] = { ...calc, id, inst };
          let [start, end, timesig, offset] = ['', '', '', ''];
          let temp_offset = false;
          return {
              instruments,
              mode: 0,
              start, end, timesig, offset, temp_offset
          };
      });
  };

  handleLock(val, e) {
      let oldLock = this.state.locks.indexOf(val);

      this.setState(oldState => {
          let locks = [...oldState.locks];
          if (oldLock >= 0)
              locks.splice(oldLock, 1)
          else
              locks.push(val);
          return ({ locks });
      });
  };

  handleMuting(val, e, ind) {
      (val.indexOf('mute') > -1) ?
          audio.mute(ind, true) : audio.mute(ind, false);
      if (val.indexOf('solo') > -1)
          this.state.instruments.forEach((inst, i) =>
              audio.mute(i, (i === ind) ? false : true));
  };

  // filter all non-numbers
  handleNumInput(e) {
      if (e.target.value === '')
          this.setState({ [e.target.name]: '' })
      else if (/^[0-9\b]+$/.test(e.target.value)) {
          let intVal = parseInt(e.target.value, 10);
          let offset = this.state.selected.meas ? this.state.selected.meas.ms : 0;
          let newMeas = {
              start: this.state.start,
              end: this.state.end,
              timesig: this.state.timesig,
              offset: this.state.offset || offset
          };
          Object.assign(newMeas, { [e.target.name]: intVal });

          let insertMeas = (['start', 'end', 'timesig'].reduce((acc, i) => acc && newMeas[i], true)) ?
              MeasureCalc(
                  newMeas, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
              ) :
              {};

          this.setState({
              [e.target.name]: intVal,
              insertMeas
          });
      };
  };

  handleNumEdit(e) {
      if (e.target.value === '') {
          this.setState({ ['edit_'.concat(e.target.name)]: '' });
      }
      else if (/^[0-9\b]+$/.test(e.target.value)) {

          let intVal = parseInt(e.target.value, 10);
          let newState = {
              ['edit_'.concat(e.target.name)]: intVal,
          };

          let minLength = 2;
          if (e.target.name === 'timesig')
              minLength = 1;
          if (e.target.value.length < minLength) {
              // visual cue that minimum hasn't been reached
              //newState.editMeas = {};
          } else {
              let newMeas = {
                  start: this.state.edit_start || this.state.selected.meas.start,
                  end: this.state.edit_end || this.state.selected.meas.end,
                  timesig: this.state.edit_timesig || this.state.selected.meas.timesig,
                  offset: this.state.edit_offset || this.state.selected.meas.offset
              };

              Object.assign(newMeas, { [e.target.name]: intVal });

              newState.editMeas = (['start', 'end', 'timesig'].reduce((acc, i) => acc && newMeas[i], true)) ?
                  MeasureCalc(
                      newMeas, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
                  ) :
                  {};
          }

          this.setState(newState);
      };
  }

  confirmEdit(e) {
      e.preventDefault();
      this.setState(oldState => {
          let instruments = oldState.instruments;
          let id = oldState.selected.meas.id;
          instruments[oldState.selected.inst].measures[id] = { ...oldState.editMeas, id };
          
          return {
              instruments,
              editMeas: {}
          }
      });
  }



  handleNameInput(e) {
      this.setState({ [e.target.name]: e.target.value })
  };


  handleOffset(focus, e) {
    this.setState({ temp_offset: focus });
  }

      


  handleTempoPPQ(eventKey) {
      document.activeElement.blur();
      let new_PPQ = PPQ_OPTIONS[eventKey];
      this.setState(oldState => new_PPQ);
  };

  handlePPQ(eventKey, e) {
    document.activeElement.blur();

    // DEPRECATED, GET THIS WORKING AGAIN
    /*let tempo_ppqs = PPQ_OPTIONS.reduce((acc, ppq, ind) => {
        console.log(ppq.PPQ_tempo);
        console.log(eventKey % ppq.PPQ_tempo);
        return (eventKey % ppq.PPQ_tempo) ?
            acc :
            [...acc, { eventKey: ind, text: `${ppq.PPQ_tempo} (${ppq.PPQ_desc})`} ]},
        []);
        */
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

      let newState = {};
      if (!isPlaying) {
          audio.kill();
      }
      else if (_.isEqual(this.state.ordered, {})) {
          var root;
          this.state.instruments.forEach((inst, i_ind) =>
              Object.keys(inst.measures).forEach((key) =>
                inst.measures[key].beats.forEach((beat) =>
                    root = ordered.tree.insert(beat + inst.measures[key].offset, inst.measures[key], root)
                )
              )
          );

          audio.play(isPlaying, root, cursor);
          newState.ordered = root;
      } else
          audio.play(isPlaying, this.state.ordered, cursor);

      document.activeElement.blur();
      newState.isPlaying = isPlaying;
      this.setState(oldState => (newState));
  }

  preview(isPreviewing) {
      if (this.state.previewTimeout)
          clearTimeout(this.state.previewTimeout);
      let kill = () => {
          audio.kill();
          this.setState({ isPreviewing: false });
      };

      if (!isPreviewing)
          kill()
      else {
          let previewMeasure = MeasureCalc({ 
              start: this.state.start,
              end: this.state.end,
              timesig: this.state.timesig,
              offset: 0
            }, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

          this.setState(oldState => ({ 
              previewMeasure, 
              isPreviewing,
              previewTimeout: setTimeout(kill, previewMeasure.ms)
          }));
          audio.play(isPreviewing, [[0 /*this.selected.inst*/, previewMeasure.beats]]);
      }
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

  tutorials(open) {
      console.log(open);
      this.setState(oldState => 
          ({ tutorialsOpen: open === undefined ?
              !oldState.tutorialsOpen :
              open
          })
      );
  }

  handleTut(tut) {
      if (this.state.tutorial_triggers[tut]) {
          this.state.tutorial_triggers[tut].begin();
          this.tutorials(false);
      } else
          alert("Not available in this version!");
  }

  load(e) {
      let fileName = e.target.files[0].name;
      var reader = new FileReader();
      reader.onload = (e) => {
          logger.log(`Loading file ${fileName}...`);
          let numInst = -1,
              numMeas = 0;
              //gaps = [];
          
          let instruments = e.target.result
              .split('\n')
              .slice(1) // remove headers
              .reduce((acc, line) => {
                  let params = line.split(',');
                  numInst = Math.max(numInst, params[0]);
                  numMeas++;
                  let newMeas = MeasureCalc(
                      ['start', 'end', 'timesig', 'offset']
                          .reduce((obj, key, ind) => ({ ...obj, [key]: parseFloat(params[ind+1], 10) }), {})
                      , { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
                  );
                  /*let spread = [newMeas.offset, newMeas.offset + newMeas.ms];
                  let clean = true;
                  if (!gaps.length) {
                      gaps.push([-Infinity, spread[0]]);
                      gaps.push([spread[1], Infinity]);
                  } else {
                      for (let i=0; i<gaps.length; i++) {
                          if (spread[0] > gaps[i][0]) {
                              if (spread[0] 
                              if (spread[1] < gaps[i][1]) {
                                  gaps.splice(i + 1, [spread[1], gaps[i][1]]);
                                  gaps[i][1] = spread[0];
                                  break;
                              } else {
                                  // ending collision
                                  alert('ending collision!');
                                  clean = false;
                                  break;
                              }
                          } else {

                      gaps = gaps.reduce((acc, gap) => {
                          if (
                          */


                  let pad = params[0] - (acc.length - 1);
                  if (pad > 0) {
                      for (let i=0; i<=pad; i++) {
                          acc.push({ measures: {} });
                      }
                  };

                  let id = uuidv4();
                  acc[params[0]].measures[id] = { ...newMeas, id, inst: params[0] };
                  return acc;
              }, []);
          logger.log(`Loaded ${numMeas} measures across ${numInst + 1} instruments.`);

          this.setState({ instruments });
      };

      reader.readAsText(e.target.files[0]);
  };


  render() {
    let CONSTANTS = {
      PPQ: this.state.PPQ,
      PPQ_tempo: this.state.PPQ_tempo,
      PPQ_mod: this.state.PPQ / this.state.PPQ_tempo,
      range: calcRange(
          this.state.instruments.reduce((acc, inst) => ({ ...acc, ...(inst.measures) }), {})
      )
    };


    var newInstruments = this.state.instruments.map((inst) => ({ 
        measures: Object.assign({}, inst.measures), 
        name: inst.name
    }));

    //var cursor = timeToChrono(this.state.cursor);
    
    let measure_inputs = [
        <FormInput
            type="text"
            key="start"
            value={this.state.start}
            ref={this.insertFocusStart}
            id="startInsert"
            placeholder="start"
            name="start"
            onChange={this.handleNumInput}
        />, 
        <FormInput
            type="text"
            key="end"
            value={this.state.end}
            ref={this.insertFocusEnd}
            id="endInsert"
            placeholder="end"
            name="end"
            onChange={this.handleNumInput}
        />,
        <FormInput
            type="text"
            key="timesig"
            value={this.state.timesig}
            ref={this.insertFocusTimesig}
            id="timesigInsert"
            placeholder="timesig"
            name="timesig"
            onChange={this.handleNumInput}
        />
    ];

    let edit_inputs = ['start', 'end', 'timesig'].map((name) => 
        <FormInput
            id={name}
            type="text"
            key={name}
            value={this.state['edit_' + name]}
            placeholder={name}
            name={name}
            style={{ float: 'left' }}
            onChange={this.handleNumEdit}
        />
    );


    let pad = CONFIG.CANVAS_PADDING;
    let addPad = pad + CONFIG.PANES_WIDTH;



    let newPane = <form onSubmit={this.handleInst} className="inst-form" autoComplete="off">
        <FormInput
            ref={this.instNameFocus}
            type="text"
            name="instName"
            value={this.state.instName}
            placeholder="NAME"
            onChange={this.handleNameInput}
        ></FormInput>

        <button type="submit" disabled={!this.state.instName}>&#x219D;</button>
    </form>

    let panes = this.state.instruments.map((inst, ind) => {
        let top = ind*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT;
        return (<Pane className="pane" key={ind} x={pad} y={top} height={CONFIG.TRACK_HEIGHT}>
            <AudioButton x={0} y={0} onClick={(val, e) => this.handleMuting(val, e, ind)} value="true">mute</AudioButton>
            <AudioButton x={0} y={CONFIG.INST_HEIGHT/3} onChange={(val, e) => this.handleMuting(val, e, ind)} value="false">solo</AudioButton>
        </Pane>
    )});
        
    //tempo_ppqs.forEach((p) => console.log(p));
      //

    //let modalButtons = ['Close', 'Save changes'].map((name, ind) => (<Upload key={ind}>{name}</Upload>));

    let selected = this.state.selected;

    let inst = selected.inst > -1 ?
        this.state.instruments[selected.inst] :
        {};

    let meas = 'meas' in selected ?
        selected.meas :
        {};

    let data = [];
    if (selected.inst > -1)
        data.push(<span key="name">{ inst.name }</span>);
    if (selected.meas)
        data.push(<span key="info"> : {meas.start} - {meas.end} / {meas.timesig}</span>);
      
    // add later
    /*let metadata = (<Metadata x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={window.innerHeight - CONFIG.META_HEIGHT - CONFIG.LOG_HEIGHT}>
        { data }
        <p id="sizing">View: {(this.state.sizing/1000).toFixed(2)}"</p>
      </Metadata>);
      */

    let welcome = false;

    if (!window.localStorage.getItem('returning')) {
        console.log('setting');
        welcome = true;
    }
      

    console.log(window.localStorage.getItem('returning'));
    //window.localStorage.removeItem('returning');
    return (
      <div className="App" style={{ 'backgroundColor': CONFIG.secondary }}>
        <Playback x={600} y={0} status={this.state.isPlaying.toString()} onClick={() => this.play(!this.state.isPlaying, 0)}>&#x262D;</Playback>
        <div style={{ margin: '0px'}}>

          {/* left midi controls */}
          <Panel>
              {panes}
              <NewInst x={addPad} y={this.state.instruments.length*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT} style={{ width: 'initial' }}>

              <button className={this.state.newInst ? "opened" : "closed"} onClick={(e) => this.state.newInst ? this.instClose(e) : this.instOpen(e) }>+</button>
              {this.state.newInst && newPane}
              </NewInst>
          </Panel>
          
          { (this.state.mode === 2 && this.state.selected.meas) ?
              <Edit left={CONFIG.PANES_WIDTH + CONFIG.CANVAS_PADDING + this.state.viewport + this.state.scale* this.state.selected.meas.offset}
                top={CONFIG.PLAYBACK_HEIGHT + (this.state.selected.inst + 1)*CONFIG.INST_HEIGHT}
                width={this.state.selected.meas.ms * this.state.scale}
              >
                <form onSubmit={this.confirmEdit} className="measure-form" autoComplete="off">
                    <div style={{ maxWidth: '150px', float: 'left' }}>
                        { edit_inputs }
                        <Submit type="submit" disabled={this.state.selected.inst === -1}>&#x219D;</Submit>
                    </div>
                    <div style={{ float: 'right' }}>
                        { ['s', 'e', 'd', 'sl', 'l'].map((button, index) =>
                            <Lock 
                                type="button"
                                key={button}
                                value={index + 1}
                                onClick={(e) => this.handleLock(index + 1, e)}
                                checked={this.state.locks.indexOf(index + 1) >= 0}
                            >{button}</Lock>) }
                    </div>
                </form>
              </Edit> : null
          }

          <UI mode={this.state.mode} locks={this.state.locks} instruments={newInstruments} panels={this.state.newInst} editMeas={this.state.editMeas} insertMeas={this.state.insertMeas} API={this.API} CONSTANTS={CONSTANTS}/>

          {/* right toolbar controls */}
        {/*<Rehearsal x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={CONFIG.PLAYBACK_HEIGHT}>
            rehearsal
          </Rehearsal>
          */}
          { /*metadata*/ }
        {/*<Log x={window.innerWidth - CONFIG.CANVAS_PADDING - CONFIG.TOOLBAR_WIDTH} y={window.innerHeight - CONFIG.LOG_HEIGHT - CONFIG.TRACKING_HEIGHT}>
            log
          </Log>*/}

          {/* modes */}
            { this.state.mode === 1 ? 
                <Insert left={(window.innerWidth - CONFIG.TOOLBAR_WIDTH + CONFIG.CANVAS_PADDING) / 3 }>
                    <form onSubmit={this.handleMeasure} className="measure-form" autoComplete="off">
                        {measure_inputs}
                        <FormInput
                            type="text"
                            key="offset"
                            value={this.state.offset}
                            placeholder={this.state.offset || (this.state.temp_offset && this.state.cursor) || 'offset'}
                            name="offset"
                            onFocus={(e) => this.handleOffset(true, e)}
                            onBlur={(e) => this.handleOffset(false, e)}
                            onChange={this.handleNumInput}
                        />
                        <button type="submit" disabled={this.state.selected.inst === -1}>&#x219D;</button>
                    </form>
                </Insert>
            : null }
        <TrackingBar className="tracking" left={(window.innerWidth - CONFIG.CANVAS_PADDING*2 - CONFIG.TOOLBAR_WIDTH) / 3.0 + CONFIG.CANVAS_PADDING}>
        </TrackingBar>

        { this.state.mode === 2 ?
            <Insert left={(window.innerWidth - CONFIG.TOOLBAR_WIDTH + CONFIG.CANVAS_PADDING) / 3 }>
            </Insert>

        : null }


          {/* footer */}
          <Footer style={{ width: `${window.innerWidth - CONFIG.TOOLBAR_WIDTH - CONFIG.FOOTER_PADDING*2}px` }}>
            <h1 className="flavor" style={{ display: 'inline-block' }}>BANDIT</h1>
            <Ext target="_blank" href="https://github.com/ultraturtle0/timebandit"><img className="qlink" alt="Github link" style={{ position: 'relative', bottom: '5px', width: '16px' }} src={github}/></Ext>
        
            <Ext target="_blank" href="https://twitter.com/j_kusel"><img className="qlink" alt="Twitter link" style={{ position: 'relative', bottom: '5px', width: '22px' }} src={twitter}/></Ext>
            <div style={{ position: 'relative', float: 'right', top: '32px' }}>
                <Upload onClick={this.tutorials}>tutorials</Upload>
                <Upload onClick={this.settings}>settings</Upload>
                <Upload onClick={this.reset}>new</Upload>
                <Upload onClick={this.upload}>open</Upload>
                <Upload onClick={this.save}>save</Upload>
                <Upload onClick={this.midi}>export</Upload>
            </div>

          </Footer>
        </div>

        <form autoComplete="off">
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
        <TutorialsModal
            show={this.state.tutorialsOpen}
            onHideCallback={this.tutorials}
            beginTut={this.handleTut}
        />
        <WelcomeModal
            show={welcome}
            onHide={() => window.localStorage.setItem('returning', 'true')}
            quickstart={(e) => {
                e.preventDefault();
                window.localStorage.setItem('returning', 'true')
                this.handleTut('quickstart');
            }}
        />
      </div>
    );
  }
}

export default App;
