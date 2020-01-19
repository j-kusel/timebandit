import React, { Component } from 'react';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import measure from './Sketches/measure';
import P5Wrapper from 'react-p5-wrapper';
import styled from 'styled-components';
import uuidv4 from 'uuid/v4';

var MeasureCalc = (start, end, timesig, PPQ) => {
    var ms;
    var beats = [];
    var ticks = [];
    let tick_num = PPQ * timesig;
    let cumulative = 0.0;
    let inc = (end-start)/tick_num;
    console.log({inc: inc, ticks: ticks});
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
    console.log({
        start: start,
        end: end,
        timesig: timesig,
        PPQ: PPQ,
        beats: beats,
        ticks: ticks,
        ms: ms
    });

    return {id: uuidv4(), beats, ms, ticks};
}


class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          insts: [[], []],
          measures: [],
          sizing: 5000.0,
          scroll: 0,
          PPQ: 24,
          time: 0,
          selected: {
              inst: -1,
              measure: -1
          },
          API: this.initAPI()
      }

      this.sizing = 5000.0;

      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleRecalc = this.handleRecalc.bind(this);

      this.scopeDisplay = this.scopeDisplay.bind(this);
      this.inputs = {};

  }

  initAPI() {
      var self = this;
      return {
          select: (inst, meas) => self.setState(oldState => ({selected: {inst: inst, measure: meas}})),
      };
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
          beats: parseInt(this.inputs.beats.value),
      }

      console.log(newMeasure);
      var calc = MeasureCalc(newMeasure.start, newMeasure.end, newMeasure.beats, this.state.PPQ);
      calc.offset = parseInt(this.inputs.offset.value);
      console.log(calc);
      this.setState(oldState => ({measures: oldState.measures.concat(calc)}));

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


  handleClick(inst, measure) {
      if (inst === this.state.selected.inst && measure === this.state.selected.measure) {
          inst = -1;
          measure = -1;
      }
      this.setState(oldState => ({ selected: { inst: inst, measure: measure }}));
      console.log('which hits first?');
  }

  handleRecalc(index, measure, change) {
      this.setState(oldState => {
          let measures = oldState.measures;
          let tick = measure.ticks.pop() - measure.ticks.pop();
          let BPM = 60000.0/(tick * oldState.PPQ);
          console.log(BPM);
          measures[index] = MeasureCalc(60, BPM, 5, 24);
          return ({ measures })
      });
  }

  scopeDisplay(scale) {
      this.sizing = 5000.0 * scale;
  };


      

  render() {

    var paddingLeft = 0;

    var P5Container = styled.div`
        div {
            padding-left: ${paddingLeft}px;
        }
    `;

    
    //let instOptions = this.state.insts.map((inst, index) => <option key={index} value={index}>{'inst'+index.toString()}</option>);

    return (
      <div className="App">
        { this.state.selected && <p>inst: { this.state.selected.inst } measure: {this.state.selected.measure} </p> }
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
            <P5Container>
                <P5Wrapper key={1} className="p5" sketch={measure} API={this.state.API} measures={this.state.measures} score={this.state.insts} selected={this.state.selected} callback={this.handleRecalc} wheelCallback={this.scopeDisplay} />
            </P5Container>

        </div>
      </div>
    );
  }
}

export default App;
