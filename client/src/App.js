import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Form } from 'react-bootstrap';
import { ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import measure from './Sketches/measure';
import axios from 'axios';
import P5Wrapper from 'react-p5-wrapper';
import styled from 'styled-components';
import uuidv4 from 'uuid/v4';

const DEBUG = false;

var MeasureCalc = (features, options) => {
    console.log(features);
    let start, end, timesig;
    let PPQ;
    ({ start, end, timesig } = features);
    ({ PPQ } = options);
    var ms;
    var beats = [];
    var ticks = [];
    let tick_num = options.PPQ * timesig;
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    let K = 60000.0 / PPQ;
    for (var i=0; i < tick_num; i++) {
        if (!(i%PPQ)) {
            beats.push(cumulative);
        };
        ticks.push(cumulative);
        cumulative += K / (start + inc*i);
    }
    ms = cumulative;
    beats.push(ms);

    return {start, end, timesig, beats, ms, ticks, offset: features.offset};
}

class UI extends Component {

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.locks.length !== this.props.locks.length)
            return true;
        if (nextProps.instruments.length !== this.props.instruments.length)
            return true;
        let flag = false;
        nextProps.instruments.forEach((inst, index) => {
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
    };

    render() {
        var paddingLeft = 0;

        var P5Container = styled.div`
            div {
                padding-left: ${paddingLeft}px;
            }
        `;


        return (
            <div>
                <P5Container>
                    <P5Wrapper key={1} className="p5" sketch={measure} instruments={this.props.instruments} locks={this.props.locks} API={this.props.API} CONSTANTS={this.props.CONSTANTS} />
                </P5Container>
            </div>
        );
    };
};


class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          instruments: [],
          sizing: 600.0,
          cursor: 0.0,
          scroll: 0,
          PPQ: 24,
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
          PPQ: 24
      };

      this.sizing = 600.0;
      this.location = 0.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleLock = this.handleLock.bind(this);
      this.handleInput = this.handleInput.bind(this);
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
      this.setState(oldState => ({ locks: val }));
  };

  handleInput(e) {
      this.setState({ [e.target.name]: e.target.value });
  };

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
      //let req = new XMLHttpRequest();
      //req.open("GET", "file://
      /*var uploadLink = document.createElement('input');
      uploadLink.type = "file";
      uploadLink.name = "file";
      uploadLink.onChange = (e) => console.log(e.target.files[0]);
      uploadLink.click();
      */

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
        name: Object.assign({}, inst.name)
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

    return (
      <div className="App">
        { this.state.selected && <p>inst: { this.state.selected.inst } measure: {this.state.selected.meas} </p> }
        <button onClick={this.save}>save</button>
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
        <div id="workspace" className="workspace">
            <UI locks={this.state.locks} instruments={newInstruments} API={this.API} CONSTANTS={this.CONSTANTS}/> 
        </div>
      </div>
    );
  }
}

export default App;
