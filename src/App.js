import React, { Component } from 'react';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import measure from './Sketches/measure';
import P5Wrapper from 'react-p5-wrapper';
import styled from 'styled-components';
import uuidv4 from 'uuid/v4';

const DEBUG = true;

var MeasureCalc = (features, options) => {
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
    for (var i=0; i<tick_num; i++) {
        let elapsed = (60000.0/(start + inc*i))/PPQ;
        if (!(i%PPQ)) {
            beats.push(cumulative);
        };
        ticks.push(cumulative);
        cumulative += elapsed;
    }
    ms = cumulative;
    beats.push(ms);
    ticks.push(cumulative);

    return {start, end, beats, ms, ticks, offset: features.offset};
}

class UI extends Component {

    // NEVER UPDATE
    shouldComponentUpdate(nextProps, nextState) {
        let flag = false;
        
        Object.keys(nextProps.measures)
            .forEach((key) => {
                if (!(key in this.props.measures)) {
                    flag = true;
                };
                ['start', 'end', 'offset'].forEach((attr) => {
                    if (nextProps.measures[key] !== this.props.measures[key])
                        flag = true;
                });
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
                    <P5Wrapper key={1} className="p5" sketch={measure} measures={this.props.measures} API={this.props.API} CONSTANTS={this.props.CONSTANTS} />
                </P5Container>
            </div>
        );
        // sketch={measure} API={this.state.API} measures={this.state.measures} score={this.state.insts} selected={this.state.selected} callback={this.handleRecalc} wheelCallback={this.scopeDisplay} 
    };
};


class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          insts: [[], []],
          sizing: 600.0,
          scroll: 0,
          PPQ: 24,
          time: 0,
          selected: {
              inst: -1,
              meas: -1
          },
      }

      this.state.measures = DEBUG ?
          {
              [uuidv4()]: MeasureCalc({ 
                  start: 60,
                  end: 120,
                  timesig: 5,
                  offset: 0
              }, { PPQ: this.state.PPQ })
          } :
          {};
          

      this.CONSTANTS = {
          PPQ: 24
      };

      this.sizing = 600.0;
      this.location = 0.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      //this.handleClick = this.handleClick.bind(this);

      this.inputs = {};


      this.API = this.initAPI()

  }

  initAPI() {
      var self = this;
    
      var select = (inst, meas) => self.setState(oldState => ({selected: {inst: inst, measure: meas}}));

      var updateMeasure = (id, start, end, timesig) => {
          var offset = this.state.measures[id].offset;
          var calc = MeasureCalc({ start, end, timesig, offset}, { PPQ: this.state.PPQ });
          self.setState(oldState => {
              let measures = oldState.measures;
              if (id in measures)
                  console.log('FOUND');
              measures[id] = calc;
              return { measures };
          });
      };

      var displaySelected = (selected) => self.setState(oldState => ({ selected }));

      var newScaling = (scale) => self.setState(oldState => ({sizing: 600.0 / scale}));

      return { select, updateMeasure, newScaling, displaySelected };
  }

  handleInst(e) {
      e.preventDefault();

      let newInst = {
          name: this.inputs.instName.value
      }

      this.setState((oldState) => {
          oldState.insts.push([]);
          return oldState;
      });
  }


  handleMeasure(e) {
      e.preventDefault();
      
      let newMeasure = {
          start: parseInt(this.inputs.start.value),
          end: parseInt(this.inputs.end.value),
          timesig: parseInt(this.inputs.beats.value),
          offset: parseInt(this.inputs.offset.value)
      };

      console.log('PPQ');
      console.log(this.state.PPQ);
      var calc = MeasureCalc(newMeasure, { PPQ: this.state.PPQ });
      console.log(calc);

      this.setState(oldState => {
          let measures = oldState.measures;
          measures[uuidv4()] = calc;
          return { measures };
      });

      /*var inst = this.inputs.inst.value;
      var newInst = [];
      if (this.state.selected.inst >= 0) {
          var oldInst = this.state.insts[this.state.selected.inst];
          var oldLen = oldInst.length;
          for (var i=0; i<oldLen; i++) {
              console.log(oldInst[i]);
              if (i === this.state.selected.measure) newInst.push(calc);
              newInst.push(oldInst[i]);
          }
          this.setState(oldState => {
              oldState.insts[inst] = newInst;
              return oldState;
          });
      } else {
          this.setState((oldState) => {
              oldState.insts[inst].push(calc);
              return oldState;
          });
      }*/

  }


  /*handleClick(inst, measure) {
      if (inst === this.state.selected.inst && measure === this.state.selected.measure) {
          inst = -1;
          measure = -1;
      }
      this.setState(oldState => ({ selected: { inst: inst, measure: meas }}));
      console.log('which hits first?');
  }*/


      

  render() {

    
    //let instOptions = this.state.insts.map((inst, index) => <option key={index} value={index}>{'inst'+index.toString()}</option>);


    var newMeasures = Object.assign({}, this.state.measures);

    return (
      <div className="App">
        { this.state.selected && <p>inst: { this.state.selected.inst } measure: {this.state.selected.meas} </p> }
        <form onSubmit={this.handleInst} className="inst-form">
            <FormGroup>
                <ControlLabel>new instrument</ControlLabel>
                <FormControl
                    type="text"
                    inputRef={(ref) => {this.inputs.instName = ref}}
                ></FormControl>
                <Button type="submit">new inst</Button>
            </FormGroup>
        </form>
        <form onSubmit={this.handleMeasure} className="measure-form">
            <FormGroup>
                <ControlLabel>start tempo</ControlLabel>
        {/*<FormControl
                    componentClass="select"
                    inputRef={(ref) => {this.inputs.inst = ref}}
                >
                    { instOptions }
                </FormControl>
                */}
                <FormControl
                    type="text"
                    placeholder="start"
                    inputRef={(ref) => {this.inputs.start = ref}}
                >
                </FormControl>
                <FormControl
                    type="text"
                    placeholder="end"
                    inputRef={(ref) => {this.inputs.end = ref}}
                >
                </FormControl>
                <FormControl
                    type="text"
                    placeholder="beats"
                    inputRef={(ref) => {this.inputs.beats = ref}}
                >
                </FormControl>
                <FormControl
                    type="text"
                    placeholder="offset"
                    inputRef={(ref) => {this.inputs.offset = ref}}
                >
                </FormControl>
                <Button type="submit">create</Button>
            </FormGroup>
        </form>
        <p id="sizing">Viewport time: {(this.state.sizing/1000).toFixed(2)} seconds</p>
        <div id="workspace" className="workspace">
            <UI measures={newMeasures} API={this.API} CONSTANTS={this.CONSTANTS}/> 
        </div>
      </div>
    );
  }
}

export default App;
