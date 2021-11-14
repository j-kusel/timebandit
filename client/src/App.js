import React, { Component } from 'react';
import _ from 'lodash';
import 'bootstrap/dist/css/bootstrap.min.css';
import uuidv4 from 'uuid/v4';
import { click_track } from './Audio/midi';
import audio from './Audio/audio';

// logos
import github from './static/GitHub-Mark-32px.png';
import twitter from './static/Twitter_Logo_WhiteOnImage.svg';

import { MeasureCalc, SchemaCalc, EventCalc, order_by_key, abs_location } from './Util/index';
import ordered from './Util/ordered';
import logger from './Util/logger';
import { Parser } from './Util/parser';
import UI from './Components/Canvas';
import Server from './Components/Server';
import Mixer from './Components/Mixer';
import { InputGroup, Container, Row, Col } from 'react-bootstrap';
import { TBButton, Splash, FormInput, PlusButton, ArrowButton, NewInst, StyledInputGroup, TrackingBar, Insert, Ext, Footer, Upload } from 'bandit-lib';
import { ExportModal, SettingsModal, WarningModal, NewFileModal, TutorialsModal, WelcomeModal } from './Components/Modals';

import CONFIG from './config/CONFIG.json';
import debug from './Util/debug.json';

const DEBUG = process.env.NODE_ENV === 'development';
var socket;

const PPQ_OPTIONS = CONFIG.PPQ_OPTIONS.map(o => ({ PPQ_tempo: o[0], PPQ_desc: o[1] }));
// later do custom PPQs

/**
 * calculates range
 */
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

if (process.env.NODE_ENV !== 'development')
    window.onbeforeunload = (e) => {
        e.preventDefault();
        return 'Are you sure? Any unsaved work will be lost.';
    }


/**
 * Main React app component
 *
 * @component
 */
class App extends Component {
  constructor(props, context) {
      super(props, context);

      let state = {
          filename: 'untitled',
          instruments: [/*{
              name: 'default',
              measures: {}
          }*/],
          markers: {},
          ordered: {},
          cursor: 0.0,
          start: '',
          end: '',
          timesig: '',
          denom: '',
          edit_start: '',
          edit_end: '',
          edit_timesig: '',
          edit_denom: '',
          offset: '',
          instName: '',
          temp_offset: false, /*'',*/
          temp_start: false, /*'',*/
          temp_end: false, /*'',*/
          scale: 1,
          viewport: 0,
          time: 0,
          selected: { },
          previewMeasure: {},
          insertMeas: {},
          editMeas: {},
          insertInst: -1,
          tracking: 0,
          locks: [],
          mode: 0,
          PPQ: CONFIG.PPQ_default,
          tutorials: {},
          pollingCb: () => null,
          scrollY: 0,
          mouseBlocker: () => false
      };

      [
        'isPlaying', 'isPreviewing',
        'keysDisabled',
        'newInst', 'newFile',
        'exportsOpen', 'printoutExport',
        'partialExport'
      // I THINK THIS WAS AN ERROR?
      //].forEach(key => this.state.key = false);
      ].forEach(key => state[key] = false);
      [
        'insertFocusStart', 'insertFocusEnd', 'insertFocusTimesig', 'insertSubmitFocus',
        'instNameFocus',
        'editFocusStart', 'editFocusEnd', 'editFocusTimesig'
      ].forEach(ref => this[ref] = React.createRef());
      /*
      this.insertFocusStart = React.createRef();
      this.insertFocusEnd = React.createRef();
      this.insertFocusTimesig = React.createRef();
      this.insertSubmitFocus = React.createRef();
      this.instNameFocus = React.createRef();
      this.editFocusStart = React.createRef();
      this.editFocusEnd = React.createRef();
      this.editFocusTimesig = React.createRef();
      */

      Object.assign(state, PPQ_OPTIONS[1]);
      state.reservePPQ = state.PPQ;
      state.reservePPQ_tempo = state.PPQ_tempo;

      // trigger subscription for server
      // BUNDLE INSTRUMENT TRIGGERS LATER
      audio.triggerHook((instIds) => {
          let targets = this.state.instruments.reduce((acc, inst, i) =>
              (instIds.indexOf(i) >= 0) ?
                  acc |= (1 << i) : acc
          , 0b00000000);
          if (socket && targets)
              socket.emit('trigger', targets);
      });

      state.PPQ_mod = state.PPQ / state.PPQ_tempo;

      let parser = new Parser(state.PPQ, state.PPQ_tempo);

      // load DEBUG script
      state.instruments = DEBUG ? parser.parse(debug) : [{ name: 'default', measures: {}, audioId: uuidv4() }];
      state.instruments.forEach((inst, ind) => audio.newInst(inst.audioId, { type: 'sine', frequency: 440*(ind + 1) }));

      this.state = state;
      
      this.location = 0.0;

	  let self = this;
	  [
		  'handleMeasure',
		  'handleInst',
		  'handleTut',
		  'handleLock',
		  'handleNumInput',
		  //'handleNumEdit',
		  'handleNameInput',
		  'handleOffset',
		  'selectPPQ',
		  'selectTempoPPQ',
		  'handleInstMove',

		  'instToggle',
		  
		  'midi', 'play', 'preview', 'kill',
		  'save', 'load', 'upload', 'reset', 'settings',
          'printout',
		  'handleNew', 'handleOpen',
		  //'confirmEdit',
		  'toggleTutorials',
		  'toggleExports',
          'focusInsertSubmit',
          'setStateHistory',
          'undoStateHistory',
          'redoStateHistory'

	  ].forEach(func => self[func] = self[func].bind(this));

      this.history = [];
      this.redo = [];
      this.API = this.initAPI();
  }

  setStateHistory(func) {
    // eliminate redo history
    this.redo = [];
    this.history.push(_.cloneDeep(this.state));
    this.setState(oldState => func(oldState));
  }

  undoStateHistory() {
    console.log('undoing...');
    if (!this.history.length)
      return;
    let last = this.history.pop();
      
    this.redo.push(_.cloneDeep(this.state));
    this.setState(last);
  }

  redoStateHistory() {
    console.log('redoing...');
    if (!this.redo.length)
      return;
    let next = this.redo.pop();
    this.history.push(_.cloneDeep(this.state));
    this.setState(next);
  }

  /**
   * Exposes a websocket from the {@link Server} component to the main App
   * @param {Object} socket - An active socket.io client object
   */
  registerSocket(s) {
    if (socket)
      socket.close();
    socket = s;
  }

  focusInsertSubmit() {
      console.log('getting here');
      this.insertSubmitFocus.current.focus();
  }


  initAPI() {
      var self = this;

      var undo = this.undoStateHistory/*(this)*/;
      var redo = this.redoStateHistory/*(this)*/;

      var get = (name) => {
          if (name === 'isPlaying')
            return self.state.isPlaying;
      };

      var modalCheck = () => 
          ['warningNew', 'warningOpen', 'settingsOpen', 'tutorialsOpen', 'exportsOpen'].some(o => this.state[o]);

      var printoutCheck = () => this.state.printoutExport;
      var printoutSet = (bool) => this.setState({ printoutExport: bool });

      var registerTuts = (obj) => {
          let tutorials = {}
          Object.keys(obj).forEach(tut => 
              (tut.indexOf('_') !== 0) ?
                  tutorials[tut] = obj[tut] : null
          );
          this.setState({ mouseBlocker: obj._mouseBlocker, tutorials });
      }

      var registerPollingFlag = (func) => {
          this.setState({ pollingCb: func });
      }
      
      var updateInst = (inst, { name } = {}) => {
          if (inst < this.state.instruments.length) {
              if (name)
                  this.setState(oldState => {
                      let instruments = oldState.instruments;
                      instruments[inst].name = name;
                      return { instruments };
                  });
          }
      }

      var deleteSchema = (measure, schema) => {
          self.setStateHistory(oldState => {
              let instruments = oldState.instruments;
              let meas = Object.assign({},instruments[measure.inst].measures[measure.id]);

              meas.events = meas.events.filter(event =>
                !(event.beat_start >= schema.beat_start && event.beat_start + event.beat_dur < schema.beat_end));
              console.log(meas.events);

              let s = schema;
              if (s.parent) {
                  delete s.parent.schemas[s.beat_start];
                  s.parent.schemaIds.splice(
                      s.parent.schemaIds.indexOf(s.beat_start), 1);
                  while (s.parent) s = s.parent;
                  meas.schemas[s.beat_start] = s;
              } else {
                  delete meas.schemas[s.beat_start];
                  meas.schemaIds.splice(
                      meas.schemaIds.indexOf(s.beat_start), 1);
              }
                            
              instruments[meas.inst].measures[meas.id] = meas;
              return ({ instruments });
          });
      }

      var updateMarker = (marker) => {
          self.setStateHistory(oldState => {
            let markers = Object.assign({}, oldState.markers);
            markers[marker.start] = marker;
            return ({ markers });
          });
      }

      var deleteMarker = (marker) => {
          self.setStateHistory(oldState => {
            let markers = Object.assign({}, oldState.markers);
            delete markers[marker.start];
            return ({ markers });
          });
      }

      var deleteEvent = (measure, event) => {
          self.setStateHistory(oldState => {
              let instruments = oldState.instruments;
              let meas = Object.assign({},instruments[measure.inst].measures[measure.id]);
              meas.events = meas.events.filter(e =>
                !(event.beat_start === e.beat_start));
              instruments[meas.inst].measures[meas.id] = meas;
              return ({ instruments });
          });
      }

      var updateEvent = (selected) => {
          self.setStateHistory(oldState => {
              let instruments = oldState.instruments;
              console.log(selected.event);
              let meas = Object.assign({},instruments[selected.inst].measures[selected.id]);

              let event = selected.event;


              if (event.tuplet[0] !== event.tuplet[1]) {
                  event.beat_dur *= event.tuplet[1] / event.tuplet[0];
                  event.tick_dur *= event.tuplet[1] / event.tuplet[0];

                  let schema = _.pick(event, ['beat_start', 'tuplet', 'basis']);
                  let beat = event.beat;//place.join('/');
                  Object.assign(schema, {
                      nominal: `(${schema.tuplet.join('/')}-${schema.basis}: ${beat})`,
                      beat,
                      beat_end: schema.beat_start + event.beat_dur*schema.tuplet[0],
                  });
                  let PPB = (4/meas.denom) * this.state.PPQ;
                  schema.beat_dur = schema.beat_end - schema.beat_start;
                  schema.tick_start = schema.beat_start * PPB;
                  schema.tick_end = schema.beat_end * PPB;
                  let div = (schema.tick_end - schema.tick_start)/schema.tuplet[0];
                  schema.tick_beats = Array.from({length: schema.tuplet[0]}, 
                      (__,i) => schema.tick_start + i*div);

                  // attach new schema to parent schema, if any
                  if (event.schema) {
                      if (!event.schema.schemas) {
                          event.schema.schemas = {};
                          event.schema.schemaIds = [];
                      }
                      if (!event.schema.schemaIds.some((c,i) =>
                          (c > event.beat_start) &&
                              event.schema.schemaIds.splice(i,0,event.beat_start)
                      ))
                          event.schema.schemaIds.push(event.beat_start);
                      event.schema.schemas[event.beat_start] = schema;
                      schema.parent = event.schema;
                  } else {
                      // don't attach subschemas to measure
                      if (!('schemas' in meas)) meas.schemas = {};
                      if (!('schemaIds' in meas)) meas.schemaIds = [];

                      meas.schemas[event.beat_start] = schema;
                      if(!meas.schemaIds.some((n,i) =>
                          (event.beat_start < n) && meas.schemaIds.splice(i, 0, event.beat_start)
                      ))
                          meas.schemaIds.push(event.beat_start);
                  };
                  // replace parent schema with new schema created by event
                  event.schema = schema;
                  // change event nominal to reflect that it's in
                  // its own created schema, with a "beat" relative
                  // to this schema
                  event.nominal.shift();
                  event.nominal.unshift(event.note + ": 1/" + schema.basis, schema.nominal);
                  
              }

              event.ms_start = abs_location(meas.ticks, meas.ms, event.tick_start);
              event.ms_end = abs_location(meas.ticks, meas.ms, event.tick_start + event.tick_dur);
              
              if (!(meas.events && meas.events.length))
                  meas.events = [event]
              // event insertion might conflict with other events!
              else {
                  let events = meas.events.slice(0);
                  if (!events.some((n,i) =>
                      (event.tick_start < n.tick_start) && events.splice(i, 0, event)
                  ))
                      events.push(event);
                  meas.events = events;
              }

              console.log(event);
              instruments[selected.inst].measures[selected.id] = meas;
              return ({ instruments });
          });
      };

      var updateMeasure = (selected) => {
          self.setStateHistory(oldState => {
            // ensure selected argument is an Array
            if (!Array.isArray(selected))
              selected = [selected];

            // re-order measures
            let instruments = oldState.instruments;
            let ordered_cpy = Object.assign(oldState.ordered, {});
            selected.forEach((meas) => {
              let inst, id;
              ({ inst, id } = meas);

              logger.log(`Updating measure ${id} in instrument ${inst}.`);  
              let oldMeas = this.state.instruments[inst].measures[id];
              var calc = MeasureCalc(
                _.pick(meas, ['start','end','timesig','offset','denom']),
                { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
              );

              // preserve locks
              if ('locks' in oldMeas)
                  calc.locks = Object.assign({}, oldMeas.locks);

              let newMeas = { ...calc, id, inst, beat_nodes: [], locks: {}, events: [], schemas: {}, schemaIds: [] };
              if (Object.keys(ordered_cpy))
                  calc.beats.forEach((beat, ind) =>
                      ordered.tree.edit(ordered_cpy, {
                          inst,
                          newMeas,
                          _clear: oldMeas.beats[ind] + oldMeas.offset,
                          _target: beat + newMeas.offset
                      })
                  );

              instruments[inst].measures[id] = newMeas;
            });
            return { instruments, ordered: ordered_cpy };
          });
      };

      var deleteMeasure = (selected) => {
          console.log(selected);
          this.setStateHistory(oldState => {
              let ordered_cpy = oldState.ordered;
              if (Object.keys(ordered_cpy)) {
                  selected.forEach(meas => {
                      let meas_to_delete = oldState.instruments[meas.inst].measures[meas.id];
                      meas_to_delete
                          .beats.forEach((beat, ind) => {
                              ordered.tree.edit(ordered_cpy, { _clear: beat + meas_to_delete.offset, inst: selected.inst });
                          });
                  });
              }

              selected.forEach(meas => {
                  logger.log(`Deleting measure ${meas.id} from instrument ${meas.inst}.`);
                  delete oldState.instruments[meas.inst].measures[meas.id]
              });
              return { instruments: oldState.instruments, selected: {}, ordered: ordered_cpy };
          });
          //self.setState/*History({ instruments: oldState.instruments, selected: {}, ordered: ordered_cpy });*/
      }

      /**
       * Updates React application state with the current selection
       */
      var displaySelected = (selected) => {
          self.setStateHistory(oldState => {
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
              return newState;
          });
      };

      var exportSelected = (selected) => {
          let instruments = this.state.instruments.map(
              (inst,i) => ({ measures: {}, name: inst.name })
          );
          selected.forEach(sel =>
              instruments[sel.inst].measures[sel.id] = sel
          );
          /*instruments.forEach(inst =>
              inst.ordered = order_by_key(inst.measures, 'offset')
          );*/
          this.setState({ partialExport: instruments, exportsOpen: true });
      }

      var newFile = () => {
          // clear history here
          self.setState({
              selected: { inst: -1, meas: undefined },
              instruments: [{ name: 'default', measures: {}, audioId: uuidv4() }],
              ordered: {}
          });
      }

      var newCursor = (loc, meta) => {
          let newState = { cursor: loc };
          if ('insertMeas' in meta)
            newState.offset = meta.insertMeas;
          self.setState(newState);
      };

      var paste = (inst, measure, offset) => {
          logger.log(`Pasting copied measure ${measure.id} into instrument ${inst}...`);
          var calc = MeasureCalc({ start: measure.start, end: measure.end, timesig: measure.beats.length - 1, offset}, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });
          self.setStateHistory(oldState => {
              let instruments = oldState.instruments;
              let id = uuidv4();

              instruments[inst].measures[id] = { ...calc, id, inst, beat_nodes: [], locks: {}, schemas: {}, schemaIds: [] };
              logger.log(`New measure ${id} created in instrument ${inst}.`);
              return { instruments };
          });
      };

      var play = (cursor, loop) => {
          logger.log(`Starting playback at ${cursor}ms.`);
          this.play(!this.state.isPlaying, cursor ? cursor : 0, loop);
      };

      var changeLoop = (loop) => {
          // add this later!
      }

      var preview = (cursor) => {
          this.preview(!this.state.isPreviewing);
      };

      var exposeTracking = () => ({
          context: audio.context,
          locator: audio.locator
      });

      // makes sure menus aren't in use when pressing keys
      var checkFocus = () =>
          [this.insertFocusStart, this.insertFocusEnd, this.insertFocusTimesig, this.instNameFocus, this.editFocusStart, this.editFocusEnd, this.editFocusTimesig]
              .reduce((acc, ref) => {
                  if (/*!document.activeElement || */!ref.current)
                      return acc;
                  return (acc || ref.current.id === document.activeElement.id);
              }, false); 

      var toggleInst = (open) => this.instToggle(!open);
              
      var updateMode = (mode) => {
          logger.log(`Entering mode ${mode}.`);
          let newState = { mode };
          if (mode === 1) {
            this.setState(newState);
            this.insertFocusStart.current.focus();
          } else {
              newState.insertMeas = {};
              /*if (mode === 2) {
                //['start', 'end', 'timesig'].forEach(x => newState['edit_'.concat(x)] = this.selected.meas[x]);
              }
              else {
              */
                  ['start', 'end', 'timesig', 'denom', 'offset'].forEach(x => {
                      newState[x] = '';
                      newState['edit_'.concat(x)] = '';
                  });

                  newState.temp_start = false;
                  newState.temp_end = false;
                  newState.temp_offset = false;
                  newState.editMeas = {};
              //}
              this.setState(newState);
          };
      };

      var pollSelecting = (type) => {
          return (!!this.state.['temp_' + type]);
      };

      var confirmPoll = (type, result) => {
          console.log(type, result);
          // ADD TEMP BACK HERE TO CHANGE PLACEHOLDER BEFORE MOUSE RELEASE
          this.setState({ [/*'temp_' + */type]: result });
      };

      var confirmSelecting = (type, inst, offset) => {
          console.log('confirmed ', inst);
          this.setState(
              (oldState) => {
                  let insertMeas = oldState.insertMeas;
                  insertMeas.confirmed = true;
                  return ({ offset, temp_offset: false, insertInst: inst, insertMeas })
              },
              () => this.insertSubmitFocus.current.focus()
          );
          return this.state.cursor;
      };
      var enterSelecting = () => this.insertSubmitFocus.current.click();

      var reportWindow = (viewport, scale, scrollY) => this.setState({ viewport, scale, scrollY });

      var disableKeys = () => this.state.keysDisabled;

      var updateEdit = (s, e, ts, off) => this.setState({
          edit_start: s,
          edit_end: e,
          edit_timesig: ts,
      });

      var newInstrument = (name) =>
          this.setStateHistory(oldState => {
              let instruments = oldState.instruments;
              let audioId = uuidv4();
              let frequency = instruments.length ?
                  audio.getFrequency(instruments[instruments.length-1].audioId) * 2 : 440;
              audio.newInst(audioId, { type: 'sine', frequency })
              instruments.push({ name, measures: {}, audioId });
              return ({ instruments });
          });


      var newMeasure = (measures) => { //inst, start, end, timesig, offset) => {
          if (!Array.isArray(measures))
            measures = [measures];

          this.setStateHistory(oldState => {
              let newState = _.pick(oldState, ['instruments', 'ordered']);
              measures.forEach(meas => {
                  var calc = MeasureCalc(
                    _.pick(meas, ['start', 'end', 'timesig', 'offset', 'denom']),
                      { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
                  );

                  let id = uuidv4();
                  let inst = meas.inst;
                  let measure = { ...calc, id, inst,
                      beat_nodes: [], locks: {}, events: [] };
                  
                  newState.instruments[inst].measures[id] = measure;
                  measure.beats.forEach((beat) =>
                      newState.ordered = ordered.tree.insert(beat + measure.offset, measure, newState.ordered)
                  );
              });
              return newState;
          });

          //this.setState(newState);
          //return measure;
      };

      return { undo, redo, printoutSet, printoutCheck, registerTuts, registerPollingFlag, modalCheck, newFile, newInstrument, newMeasure, toggleInst, pollSelecting, confirmPoll, confirmSelecting, enterSelecting, get, deleteMeasure, deleteSchema, updateInst, updateMeasure, updateMarker, deleteMarker, updateEvent, deleteEvent, newCursor, displaySelected, exportSelected, paste, play, changeLoop, preview, exposeTracking, updateMode, reportWindow, disableKeys, updateEdit, checkFocus };
  }

  /**
   * Focuses instName input when new instrument tab is opened
   *
   */
  instToggle(open) {
      if (this.state.mouseBlocker())
          return;

      let _open = (typeof open === 'undefined') ?
          !this.state.newInst : open;
      _open ?
        this.setState(() => ({ newInst: true }), () => this.instNameFocus.current.focus()) :
        this.setState({ newInst: false, instName: '' });
  }

  printout() {
    this.setState({ printoutExport: true, exportsOpen: false });
  }

  handleInst(e) {
      e.preventDefault();
      if (this.state.mouseBlocker())
          return;

      let audioId = uuidv4();
      let frequency = this.state.instruments.length ?
          audio.getFrequency(this.state.instruments[this.state.instruments.length-1].audioId) * 2 : 440;
      audio.newInst(audioId, { type: 'sine', frequency })

      let newInst = {
          name: this.state.instName,
          measures: {},
          audioId
      }

      this.setStateHistory((oldState) => {
          // add after selected
          let selected = oldState.selected.inst;
          let loc = ((!selected) || selected === -1) ?
              oldState.instruments.length :
              selected;
          oldState.instruments.splice(loc + 1, 0, newInst);
          oldState.instName = '';
          oldState.newInst = false;
          logger.log(`Adding new instrument in slot ${loc}.`);
          return oldState;
      });
  }

  handleInstMove(inst, dir) {
      if ((dir === 'up' && inst === 0) ||
          (dir === 'down' && inst === this.state.instruments.length-1)
      )
          return;
      this.setStateHistory(oldState => {
          let instruments = [].concat(oldState.instruments);
          let [moved] = instruments.splice(inst, 1);
          instruments.splice(dir === 'up' ? inst-1 : inst+1, 0, moved);
          // update all measures' inst information
          instruments.forEach((inst, ind) => 
              Object.keys(inst.measures).forEach(key =>
                  inst.measures[key].inst = ind
              )
          );
          return { instruments }
      });
  }

  handleMeasure(e) {
      e.preventDefault();
      if (this.state.mouseBlocker())
          return;
           
      let inst = (this.state.insertInst >= 0) ?
          this.state.insertInst : this.state.selected.inst;

      if (inst === undefined) {
          alert('select an instrument first!');
          return;
      }

      
      let selected = this.state.selected.meas;
      let newMeasure = {
          start: parseInt(this.state.start, 10),
          end: parseInt(this.state.end, 10),
          timesig: parseInt(this.state.timesig, 10),
          denom: parseInt(this.state.denom, 10),
          offset: this.state.offset ? parseFloat(this.state.offset) : selected.ms + selected.offset,
      };

      var calc = MeasureCalc(newMeasure, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo });

      this.setStateHistory(oldState => {
          let instruments = oldState.instruments;
          let id = uuidv4();
          instruments[inst].measures[id] = { 
              ...calc, 
              id, inst, schemas: {},
              schemaIds: [], events: [],
          };

          let [start, end, timesig, denom, offset] = ['', '', '', '', ''];
          let temp_start = false;
          let temp_end = false;
          let temp_offset = false;
          let newOrdered = Object.assign(oldState.ordered, {});
          calc.beats.forEach((beat) =>
              newOrdered = ordered.tree.insert(beat + newMeasure.offset, instruments[inst].measures[id], newOrdered)
          );
          return {
              ordered: newOrdered,
              instruments,
              insertMeas: {},
              mode: 0,
              start, end, timesig, denom, offset,
              temp_start, temp_end, temp_offset
          };
      });
  };

  handleLock(val, e) {
      if (this.state.mouseBlocker())
          return;
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
      if (this.state.mouseBlocker())
          return;

      (val.indexOf('mute') > -1) ?
          audio.mute(ind, true) : audio.mute(ind, false);
      if (val.indexOf('solo') > -1)
          this.state.instruments.forEach((inst, i) =>
              audio.mute(i, (i === ind) ? false : true));
  };

  // filter all non-numbers
  handleNumInput(e) {
      if (this.state.mouseBlocker())
          return;

      if (e.target.value === '')
          this.setState({ [e.target.name]: '' })
      else if (/^[0-9\b]+$/.test(e.target.value)) {
          let intVal = parseInt(e.target.value, 10);
          let offset = this.state.selected.meas ? this.state.selected.meas.ms : 0;
          let newMeas = {
              start: this.state.start,
              end: this.state.end,
              timesig: this.state.timesig,
              denom: this.state.denom,
              offset: this.state.offset || offset
          };
          Object.assign(newMeas, { [e.target.name]: intVal });

          let insertMeas = (['start', 'end', 'timesig', 'denom'].reduce((acc, i) => acc && newMeas[i], true)) ?
              MeasureCalc(
                  newMeas, { PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo }
              ) :
              {};

          let newState = {
              [e.target.name]: intVal,
              insertMeas
          };

          if (e.target.name === 'start' 
              && (!this.state.end || this.state.start === this.state.end)
          )
              newState.end = intVal;
          console.log(newState);

          this.setState(newState);
      };
  };

  /*handleNumEdit(e) {
      if (this.state.mouseBlocker())
          return;

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
  */

  /*confirmEdit(e) {
      if (this.state.mouseBlocker())
          return;

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
  */

  handleNameInput(e) {
      if (this.state.mouseBlocker())
          return;

      this.setState({ [e.target.name]: e.target.value })
  };


  handleStart(focus, e) {
      if (this.state.mouseBlocker())
          return;
      this.state.pollingCb(focus && 'start');
      this.setState({ temp_start: focus });
  }
  handleEnd(focus, e) {
      if (this.state.mouseBlocker())
          return;
      this.state.pollingCb(focus && 'end');
      this.setState({ temp_end: focus });
  }
  handleOffset(focus, e) {
      if (this.state.mouseBlocker())
          return;
      this.setState({ temp_offset: focus });
  }


  selectTempoPPQ(eventKey) {
      document.activeElement.blur();
      console.log(eventKey, PPQ_OPTIONS[eventKey]);
      let new_PPQ = PPQ_OPTIONS[eventKey];
      let newState = { reservePPQ_tempo: new_PPQ.PPQ_tempo, PPQ_desc: new_PPQ.PPQ_desc };
      this.setState(newState);
  };

  selectPPQ(eventKey, e) {
    document.activeElement.blur();
    this.setState(oldState => ({ reservePPQ: eventKey }));
  };

  midi(type) {
      let instruments = this.state.partialExport || this.state.instruments;
      if (type === 'global') {
          // gotta convert everything to 60 BPM.
          // going to try calculating absolute tick location as a percentage of the whole score.
          // this will (ideally) lessen the dependency that beat locations have on each other,
          // an unfortunate by-product of the midi protocol.
          // this works so well it should be adapted to the independent export!
          let tick_perc = this.state.PPQ / (60000.0 / 300); // Parts-Per-Quarter (per beat) / 1000ms per beat

          let tracks = instruments.map((inst, i_ind) => {
              let tick_accum = 0;
              // iterate through measures, adding offsets
              let beats = [];
              let tempi = [{ tempo: 300, timesig: 4 }];

              order_by_key(inst.measures, 'offset').forEach((meas, m_ind) => {
                  // calculate number of ticks to rest for first beat
                  let absolute = parseInt(meas.offset * tick_perc, 10);
                  let delta = Math.max(absolute - tick_accum, 0);

                  beats.push({ wait: `T${delta}`, duration: 'T1', pitch: ['C4'] });
                  tick_accum += delta + 1;
                  for (let b = 1; b < meas.beats.length - 1; b++) {
                      let beat = meas.beats[b];
                      absolute = parseInt((beat + meas.offset) * tick_perc, 10);
                      delta = Math.max(absolute - tick_accum, 0); 
                      beats.push({ wait: `T${delta}`, duration: 'T1', pitch: ['C4'] });
                      tick_accum += delta + 1; // +1 to account for actual T1 note.
                  };
              });

              // return track object
              return ({ tempi, beats, name: inst.name });
          });

          click_track(tracks, this.state.PPQ, this.state.PPQ_tempo);
          return;
      }

      // this eventually needs to use a similar absolute time system for constant error correction.
      let tracks = instruments.map((inst, i_ind) => {

          // this would be solved by sorting measures on entry
          // looking for gaps between measures
          // lets assume they're in order for now.
          /*let spreads = Object.keys(inst.measures).reduce((acc, key) =>
              [inst.measures[key].offset, inst.measures[key].ms], []);
              */

          // fill gaps with appropriate number of ticks at given BPM
          let last = 0;

          let tpm = 60000.0 / this.state.PPQ;


          let clicks = [];
          let rest = `T${this.state.PPQ - 1}`;
          let tempi = order_by_key(inst.measures, 'offset').reduce((acc, meas, ind) => {
              // push empty message if within delta threshold

              let PPB = (4/last.denom) * this.state.PPQ;

              let delta = this.state.PPQ - 1;

              if (last) {
                  let gap = meas.offset - (last.offset + last.ms);
                  if (gap > CONFIG.DELTA_THRESHOLD) {
                      let gap_tempo = 300;
                      let beat_total = (gap_tempo / 60000.0) * gap;
                      delta = Math.round(beat_total * this.state.PPQ);
                      acc.push({ delta, tempo: gap_tempo });
                      // if we're not adding final beats of measures,
                      // need to delay first measure after gaps
                      // by one "beat" (PPQ);
                      delta += PPB;

                      // testing a gap offset correction here
                      delta -= 1;
                  }
              } else {
                  // or default to ? bpm for initial gap
                  delta = Math.round(meas.offset / (tpm / 300));
                  acc.push({ delta, tempo: 300 });
              };

              last = meas;

              let slope = (meas.end - meas.start)/meas.ticks.length;

              //let new_beat = { duration: 'T1', pitch: ['C4'] };


              let ev_ptr = 0;
              let event_ticks = meas.events.map(e => Math.round(e.tick_start));

              let last_tick = -delta-1;
              for (let i=0; i<meas.ticks.length; i++) {
                  let pitch = [];
                  let acc_push = (!i) ?
                      { timesig: meas.timesig, denom: meas.denom } : {}
                      
                  if (!(i % this.state.PPQ_mod)) {
                      if (!(i % (meas.ticks.length / meas.timesig)))
                          pitch.push('C4');
                      acc_push.tempo = meas.start + i * slope;
                      acc.push(acc_push);
                  };
                  if (event_ticks[ev_ptr] === i) {
                      ev_ptr++;
                      pitch.push('C5');
                  }
                  if (pitch.length) {
                      clicks.push({ duration: 'T1', pitch, wait: `T${i-last_tick-1}` });
                      last_tick = i;
                  }
              }

              return acc;
          }, []);
          
          clicks.push({ duration: 'T1', pitch: ['C4'], wait: rest });
          tempi.push({ tempo: last.end });
          return ({ tempi, clicks, name: inst.name });
      });
      
      click_track(tracks, this.state.PPQ, this.state.PPQ_tempo);

  };

  play(isPlaying, cursor, loop) {
      if (this.state.mouseBlocker())
          return;

      let newState = {};
      let audioIds = this.state.instruments.map(i => i.audioId);
      if (!isPlaying) {
          audio.kill();
      }
      //else if (_.isEqual(this.state.ordered, {})) {
          var root;
          var metro;
          this.state.instruments.forEach((inst, i_ind) =>
              Object.keys(inst.measures).forEach((key) => {
                  let meas = inst.measures[key];
                  // events
                  meas.events.forEach(event => {
                      root = ordered.tree.insert(event.ms_start + meas.offset, meas, root)
                  });

                  // metronome
                  meas.beats.forEach((beat) =>
                      metro = ordered.tree.insert(beat + inst.measures[key].offset, inst.measures[key], metro)
                  );
              })
          );

          //audio.play(isPlaying, root, cursor, audioIds, loop);
          audio.play(isPlaying, metro, cursor, audioIds, loop);
          //newState.ordered = root;
      /*} else
          audio.play(isPlaying, this.state.ordered, cursor, audioIds, loop);
          */

      document.activeElement.blur();
      newState.isPlaying = isPlaying;
      this.setState(newState);
  }

  preview(isPreviewing) {
      if (this.state.mouseBlocker())
          return;
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
      if (this.state.mouseBlocker())
          return;

      let insts = this.state.instruments;
      let rows = [
        ['PPQ', this.state.PPQ.toString(), 'PPQ_tempo', this.state.PPQ_tempo.toString()],
        ['inst', 'start', 'end', 'timesig', 'denom', 'offset']
      ];

      Object.keys(this.state.markers).forEach(key => {
        let marker = this.state.markers[key];
        rows.push(['marker-' + marker.name, marker.start, marker.end]);
      });
      Object.keys(insts).forEach((inst) => 
          Object.keys(insts[inst].measures).forEach((measure) => {
              let meas = insts[inst].measures[measure];
              rows.push(
                  [[inst, insts[inst].name].join('-')].concat(['start', 'end', 'timesig', 'denom', 'offset']
                      .map((key) => meas[key]))
              );
              // events
              if (meas.events)
                  meas.events.forEach(e => {
                      console.log(e.nominal);
                      rows.push(
                        [''].concat(e.nominal.shift())
                            .concat(e.nominal.join(' ')));
                  });
          })
      );
      var downloadLink = document.createElement('a');
      downloadLink.href = encodeURI(`data:text/csv;utf-8,`.concat(rows.join('\n')));
      downloadLink.download = this.state.filename + '.csv';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
  };

  upload(e) {
      if (this.state.mouseBlocker())
          return;

      if (this.state.instruments.length > 1
          || Object.keys(this.state.instruments[0].measures).length)
          this.setState({ warningOpen: true })
      else
          document.getElementById('dummyLoad').click();
  }

  handleNew(e) {
      if (this.state.mouseBlocker())
          return;

      this.setState((oldState) => 
          ({ 
              instruments: [],
              PPQ: this.state.reservePPQ,
              PPQ_tempo: this.state.reservePPQ_tempo,
              PPQ_mod: this.state.reservePPQ / this.state.reservePPQ_tempo,
              newFile: false,
              selected: { inst: -1, meas: undefined },
              ordered: {}
          }),
          () => this.API = this.initAPI()
      )
  }

  handleOpen(e) {
      if (this.state.mouseBlocker())
          return;

      document.getElementById('dummyLoad').click();
      this.setState({ warningOpen: false });
  }

  reset(e) {
      if (this.state.mouseBlocker())
          return;
      this.setState({ warningNew: true });
  }

  settings(e) {
      if (this.state.mouseBlocker())
          return;
      this.setState(oldState => ({ settingsOpen: !oldState.settingsOpen }));
  }

  toggleTutorials(open) {
      if (open && this.state.mouseBlocker())
          return;
      this.setState(oldState => 
          ({ tutorialsOpen: open === undefined ?
              !oldState.tutorialsOpen :
              open
          })
      );
  }

  toggleExports() {
    this.setState(oldState => ({ exportsOpen: !oldState.exportsOpen, partialExport: false }));
  }


  handleTut(tut) {
      if (this.state.mouseBlocker())
           return;
    
      if (this.state.tutorials[tut]) {
           this.state.tutorials[tut].begin();
           this.toggleTutorials(false);
      } else
           alert("Not available in this version!");
  }

  load(e) {
      if (this.state.mouseBlocker())
          return;

      let fileName = e.target.files[0].name;
      var reader = new FileReader();
      reader.onload = (e) => {
          logger.log(`Loading file ${fileName}...`);
          let numInst = -1,
              numMeas = 0;
              //gaps = [];
          let rows = e.target.result.split('\n');

          // parse meta information in {key: value} pairs
          let meta = {};
          let metaRow = rows[0].split(',');
          for (let m=0; m<metaRow.length; m+=2)
              meta[metaRow[m]] = metaRow[m+1]
          
          let lastMeas;
          let parse = (input) => {
            let current = input.replace(/ /g, '');
            let params = current.split(':');
            let frac = params[1].split('/').map(s => parseInt(s,10));
            return { current, params, frac };
          }
          let markers = {};
          let instruments = rows
              .slice(2) // remove headers
              .reduce((acc, line) => {
                  let param = line.split(',');

                  // add markers
                  if (param.length && param[0].indexOf('marker') === 0) {
                    let name = param[0].split('-')[1];
                    markers[param[1]] = { name, start: param[1] };
                    if (param[2])
                      markers[param[1]].end = param[2];
                    return acc;  
                  }

                  // add events
                  if (param.length && !param[0]) {
                    let schema = null;
                      console.log(param, param.length);
                    if (param[2]) {
                        let schema_list = [...param[2].matchAll(/\((.[^\)]*)\)/g)].map(s=>s[1]);
                        let params, frac;
                        ({ params, frac } = parse(schema_list.pop()));
                        let beat_start = frac[0]/frac[1] * lastMeas.denom;
                        if (!(beat_start in lastMeas.schemas)) {
                            schema = SchemaCalc(params, null, lastMeas.denom, meta.PPQ);

                            lastMeas.schemas[beat_start] = schema;
                                lastMeas.schemaIds.some((s,i) =>
                                (beat_start > s) ?
                                    lastMeas.schemaIds.splice(i, 0, beat_start):
                                    false
                            ) || lastMeas.schemaIds.push(beat_start);
                        } else
                            schema = lastMeas.schemas[beat_start];
                        let lastSchema = schema;
                        while (schema_list && schema_list.length) {
                            let schema_text = schema_list.pop();
                            ({ params, frac } = parse(schema_text));
                            let ratio = lastSchema.basis / frac[1];
                            let div = lastSchema.beat_dur / lastSchema.tuplet[0] * ratio;
                            beat_start = div * frac[0] + lastSchema.beat_start;
                            if (!lastSchema.schemas) {
                                lastSchema.schemas = {};
                                lastSchema.schemaIds = [];
                            }
                            if (!(beat_start in lastSchema.schemas)) {
                                schema = SchemaCalc(params, lastSchema, lastMeas.denom, meta.PPQ);
                                lastSchema.schemas[beat_start] = schema;
                                    lastSchema.schemaIds.some((s,i) =>
                                    (beat_start > s) ?
                                        lastSchema.schemaIds.splice(i, 0, beat_start):
                                        false
                                ) || lastSchema.schemaIds.push(beat_start);
                                // add parent link to schemas, but not meas
                                if (!lastSchema.id)
                                    schema.parent = lastSchema;
                            } else
                                schema = lastSchema.schemas[beat_start];
                            lastSchema = schema;
                        }
                    }

                    let event = EventCalc(lastMeas, param, schema, this.state.PPQ);
                    if (!lastMeas.events.some((n,i) =>
                        (event.tick_start < n.tick_start) && lastMeas.events.splice(i, 0, event)
                    ))
                        lastMeas.events.push(event);
                    
                    return acc;
                  }
                      
                  let inst_text = param[0].split('-');
                  let index = parseInt(inst_text[0], 10);
                  numInst = Math.max(numInst, index);
                  numMeas++;
                  let newMeas = MeasureCalc(
                      ['start', 'end', 'timesig', 'denom', 'offset']
                          .reduce((obj, key, ind) => ({ ...obj, [key]: parseFloat(param[ind+1], 10) }), {})
                      ,
                      ('PPQ' in meta && 'PPQ_tempo' in meta) ?
                        ({ PPQ: meta.PPQ, PPQ_tempo: meta.PPQ_tempo }) :
                        ({ PPQ: this.state.PPQ, PPQ_tempo: this.state.PPQ_tempo })
                  );

                  let pad = index - (acc.length - 1);
                  if (pad > 0) {
                      for (let i=0; i<=pad; i++) {
                          acc.push({ measures: {} });
                      }
                  };

                  let id = uuidv4();
                  acc[index].measures[id] = { ...newMeas, id, inst: parseInt(inst_text[0], 10),
                    schemas: {}, schemaIds: [], events: []};
                  lastMeas = acc[index].measures[id];
                  console.log(inst_text[1]);
                  acc[index].name = inst_text[1];
                  return acc;
              }, []);
          logger.log(`Loaded ${numMeas} measures across ${numInst + 1} instruments.`);

          let newState = { instruments };
          if ('PPQ' in meta && 'PPQ_tempo' in meta)
              Object.assign(newState, { PPQ: meta.PPQ, PPQ_tempo: meta.PPQ_tempo });
          this.setState(newState);
      };

      reader.readAsText(e.target.files[0]);
  };


  render() {
    //var cursor = timeToChrono(this.state.cursor);

    let measure_inputs_1 = ['start', 'end'].map(name => {
        let cap_name = name.charAt(0).toUpperCase() + name.slice(1);
        return (<FormInput
            type="text"
            key={name}
            value={this.state[name]}
            ref={this['insertFocus' + cap_name]}
            id={name + 'Insert'}
            placeholder={this.state[name] || /*(this.state.['temp_' + name] && this.state.cursor) ||*/ name}
            name={name}
            onFocus={(e) => this['handle' + cap_name](true, e)}
            onBlur={(e) => this['handle' + cap_name](false, e)}
            onChange={this.handleNumInput}
        />)
    });
    
    let measure_inputs_2 = ['timesig', 'denom'].map(name => (
        <FormInput
            type="text"
            key={name}
            value={this.state[name]}
            ref={this['insertFocus' + name.charAt(0).toUpperCase() + name.slice(1)]}
            id={name + 'Insert'}
            placeholder={name}
            name={name}
            onChange={this.handleNumInput}
        />
    ));



    /*let edit_inputs = ['start', 'end', 'timesig'].map((name) => 
        <FormInput
            id={name}
            type="text"
            key={name}
            value={this.state['edit_' + name]}
            ref={this['editFocus' + name.charAt(0).toUpperCase() + name.slice(1)]}
            placeholder={name}
            name={name}
            style={{ float: 'left' }}
            onChange={this.handleNumEdit}
        />
    );*/

    let instPane = <form onSubmit={this.handleInst} className="inst-form" autoComplete="off">
			<StyledInputGroup>
			  <FormInput
				ref={this.instNameFocus}
				type="text"
				name="instName"
				value={this.state.instName}
				placeholder="NAME"
				onChange={this.handleNameInput}
			  />
			  <InputGroup.Append>
				<ArrowButton type="submit" disabled={!this.state.instName}>&#x25BA;</ArrowButton>
			  </InputGroup.Append>
			</StyledInputGroup>
		</form>
        
    //tempo_ppqs.forEach((p) => console.log(p));
      //

    //let modalButtons = ['Close', 'Save changes'].map((name, ind) => (<Upload key={ind}>{name}</Upload>));

    let selected = this.state.selected;

    let inst = (selected.inst > -1) || (this.state.instruments[selected.inst]) ?
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
      </Metadata>);
      */

    let welcome = false;

    if (!window.localStorage.getItem('returning'))
        welcome = true;
    let newInstHeight = this.state.instruments.length*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT - this.state.scrollY;

	let propsUI = {
        selected: this.state.selected,
		mode: this.state.mode, 
		locks: this.state.locks,
	    instruments: this.state.instruments.map((inst) => ({ 
			measures: Object.assign({}, inst.measures), 
			name: inst.name
		})),
        markers: this.state.markers,
		newInst: this.state.newInst,
	  editMeas: this.state.editMeas,
	  insertMeas: this.state.insertMeas,
	  API: this.API,
	  CONSTANTS: {
		  PPQ: this.state.PPQ,
		  PPQ_tempo: this.state.PPQ_tempo,
		  PPQ_mod: this.state.PPQ / this.state.PPQ_tempo,
		  range: calcRange(
			  this.state.instruments.reduce((acc, inst) => ({ ...acc, ...(inst.measures) }), {})
		  )
	  }
	};

    return (
      <div className="App" style={{ 'backgroundColor': CONFIG.secondary }}>
        {/*<Playback x={600} y={0} status={this.state.isPlaying.toString()} onClick={() => this.play(!this.state.isPlaying, 0)}>&#x262D;</Playback>*/}
        <div style={{ margin: '0px'}}>
          <div style={{ position: 'absolute', width: '100%' }}>
              {(newInstHeight < window.innerHeight - CONFIG.FOOTER_HEIGHT - CONFIG.TRACKING_HEIGHT*2) &&
                  <NewInst x={CONFIG.CANVAS_PADDING + CONFIG.PANES_WIDTH} y={this.state.instruments.length*CONFIG.INST_HEIGHT + CONFIG.PLAYBACK_HEIGHT - this.state.scrollY} style={{ width: 'initial' }}>
                    <PlusButton open={this.state.newInst} onClick={() => this.instToggle()}>+</PlusButton>
                    {this.state.newInst && instPane}
                  </NewInst>
              }
          </div>
          
          { /*(this.state.mode === 2 && this.state.selected.meas) &&
              <Edit left={CONFIG.PANES_WIDTH + CONFIG.CANVAS_PADDING + this.state.viewport + this.state.scale* this.state.selected.meas.offset}
                top={CONFIG.PLAYBACK_HEIGHT + (this.state.selected.inst + 1)*CONFIG.INST_HEIGHT}
                width={this.state.selected.meas.ms * this.state.scale}
              >
                <form onSubmit={this.confirmEdit} className="measure-form" autoComplete="off">
                    <StyledInputGroup style={{ maxWidth: '150px', float: 'left', marginTop: '0px' }}>
                      { edit_inputs }
                      <InputGroup.Append>
                        <ArrowButton type="submit" disabled={this.state.selected.inst === -1}>&#x25BA;</ArrowButton>
                      </InputGroup.Append>
                    </StyledInputGroup>
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
              </Edit>
          */}

		  {/* PROCESSING COMPONENT */}
          <UI {...propsUI} />

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
            { this.state.mode === 1 &&
                <Insert left={(window.innerWidth - CONFIG.TOOLBAR_WIDTH + CONFIG.CANVAS_PADDING) / 3 }>
                    <form onSubmit={this.handleMeasure} className="measure-form" autoComplete="off">
                      <StyledInputGroup>
                        {measure_inputs_1}
                        {measure_inputs_2}
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
                        <InputGroup.Append>
                            <ArrowButton type="submit" ref={this.insertSubmitFocus} disabled={this.state.selected.inst === -1}>&#x25BA;</ArrowButton>
                        </InputGroup.Append>
                      </StyledInputGroup>
                    </form>
                </Insert>
            }
        <TrackingBar className="tracking" left={(window.innerWidth - CONFIG.CANVAS_PADDING*2 - CONFIG.TOOLBAR_WIDTH) / 3.0 + CONFIG.CANVAS_PADDING}>
        </TrackingBar>

        { this.state.mode === 2 &&
            <Insert left={(window.innerWidth - CONFIG.TOOLBAR_WIDTH + CONFIG.CANVAS_PADDING) / 3 }/>
        }


          {/* footer with modules */}
          <Footer style={{ width: `${window.innerWidth - CONFIG.TOOLBAR_WIDTH - CONFIG.FOOTER_PADDING*2}px`, height: '100px' }}>
            <div style={{ height: '100%', display: 'block', float: 'left' }}>
                <Splash style={{ display: 'inline-block', margin: '0px', lineHeight: '52px' }}>BANDIT</Splash>
                <Ext target="_blank" href="https://github.com/ultraturtle0/timebandit"><img className="qlink" alt="Github link" style={{ position: 'relative', bottom: '5px', width: '16px' }} src={github}/></Ext>
                <Ext target="_blank" href="https://twitter.com/j_kusel"><img className="qlink" alt="Twitter link" style={{ position: 'relative', bottom: '5px', width: '22px' }} src={twitter}/></Ext>

                <div style={{ position: 'relative', width: '100%', height: '20px', paddingLeft: '6px', marginTop: '-10px' }}>
                    <Upload onClick={(e) => this.toggleTutorials()}>tutorials</Upload>
                    <Upload onClick={this.settings}>settings</Upload>
                    <Upload onClick={this.reset}>new</Upload>
                    <Upload onClick={this.upload}>open</Upload>
                    <Upload onClick={this.save}>save</Upload>
                    <Upload onClick={(e) => this.toggleExports()}>export</Upload>
                </div>
            </div>

                    {/*<span style={{ position: 'relative', float: 'right' }}>{this.state.filename}</span>*/}
            <Server registerSocket={this.registerSocket}/>
            <Mixer audio={audio} insts={this.state.instruments} instMove={this.handleInstMove}/>
        {/*<Logger>*/}
          </Footer>
        </div>

        <form autoComplete="off">
            <input id="dummyLoad" type="file" name="file" onChange={this.load} hidden />
        </form>

        <WarningModal
          show={this.state.warningNew}
          onHide={() => this.setState({ warningNew: false })}
          header={" - CLOSE WITHOUT SAVING?"}
          buttons={[
              { onClick: this.save, text: 'save' },
              { onClick: () => this.setState({ warningNew: false, newFile: true }), text: 'new file' }
          ]}
        />        
        <WarningModal
          show={this.state.warningOpen}
          onHide={() => this.setState({ warningOpen: false })}
          header={" - CLOSE WITHOUT SAVING?"}
          buttons={[
              { onClick: this.save, text: 'save' },
              { onClick: this.handleOpen, text: 'open file...' }
          ]}

        />        
        <NewFileModal
            show={this.state.newFile}
            onHide={() => this.setState({ newFile: false })}
            header={" - NEW FILE"}
            onTempoSelect={this.selectTempoPPQ}
            onPPQSelect={this.selectPPQ}
            settings={({
                PPQ_tempo: this.state.reservePPQ_tempo || this.state.PPQ_tempo,
                PPQ_desc: this.state.PPQ_desc,
                PPQ: this.state.reservePPQ || this.state.PPQ,
            })}
            buttons={[
                { onClick: this.handleNew, text: 'create' },
                { onClick: () => this.setState({ newFile: false }), text: 'cancel' }
            ]}
        >
          
        </NewFileModal>
        <ExportModal
            show={this.state.exportsOpen}
            onHide={this.toggleExports}
        >
            <Container>
                <Row>
                    <Col xs={4} className="text-right">
                        <TBButton onClick={this.midi}>midi (separate)</TBButton>
                    </Col>
                    <Col xs={8}>
                        <p>export each instrument as an individual midi file. preserves tempo and time signature information.</p>
                    </Col>
                </Row>
                <Row>
                    <Col xs={4} className="text-right">
                        <TBButton onClick={(e) => this.midi('global')}>midi (quantized)</TBButton>
                    </Col>
                    <Col xs={8}>
                        <p>export all instruments as midi click tracks in a global file. quantizes all beats to 60BPM.</p>
                    </Col>
                </Row>

                <Row>
                    <Col xs={4} className="text-right">
                        <TBButton onClick={this.printout}>printout</TBButton>
                    </Col>
                    <Col xs={8}>
                    </Col>
                </Row>
            </Container>
        </ExportModal>

            
            
        <SettingsModal
            show={this.state.settingsOpen}
            onHideCallback={this.settings}
            onTempoSelect={this.selectTempoPPQ}
            onPPQSelect={this.selectPPQ}
            settings={({
                PPQ_tempo: this.state.reservePPQ_tempo || this.state.PPQ_tempo,
                PPQ_desc: this.state.PPQ_desc,
                PPQ: this.state.reservePPQ || this.state.PPQ,
            })}
        />
        <TutorialsModal
            show={this.state.tutorialsOpen}
            onHideCallback={this.toggleTutorials}
            tuts={this.state.tutorials}
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
