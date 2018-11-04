import React, { Component } from 'react';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import Measure from "./Components/Measure";

var MeasureCalc = (start, end, timesig, PPQ) => {
    var ms;
    var beats = [];
    let ticks = PPQ * timesig;
    let cumulative = 0.0;
    let inc = (end-start)/ticks;
    console.log({inc: inc, ticks: ticks});
    for (var i=0; i<ticks; i++) {
        let elapsed = (60000.0/(start + inc*i))/PPQ;
        if (!(i%PPQ)) {
            beats.push(cumulative);
        }
        cumulative += elapsed;
        console.log(cumulative);
    }
    ms = cumulative;
    console.log({
        start: start,
        end: end,
        timesig: timesig,
        PPQ: PPQ,
        beats: beats,
        ticks: ticks,
        ms: ms
    });

    

    return {beats: beats, ms: ms};
}


class App extends Component {
  constructor(props, context) {
      super(props, context);

      this.state = {
          insts: [[], []],
          sizing: 5000.0,
          scroll: 0,
          PPQ: 24,
          time: 0
      }
      this.handleMeasure = this.handleMeasure.bind(this);
      this.handleInst = this.handleInst.bind(this);
      this.handleWheel = this.handleWheel.bind(this);

      this.inputs = {};

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
          beats: parseInt(this.inputs.beats.value)
      }

      var calc = MeasureCalc(newMeasure.start, newMeasure.end, newMeasure.beats, this.state.PPQ);
      console.log(calc);

      console.log(newMeasure);

      this.setState((oldState) => {
          oldState.insts[this.inputs.inst.value].push(calc);
          return oldState;
      });
  }

  handleWheel(e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          let percent = e.deltaY/200.0;
          this.setState((oldState) => ({sizing: oldState.sizing*(1.0-percent)}));
      }
  }

  render() {
    let insts = this.state.insts.map((inst, index) => {

        let measures = inst.map((measure, index2) => {
            return (
                <div className="measure">
                    <Measure className="measure" key={index2} beats={measure.beats} len={measure.ms} sizing={this.state.sizing}/>
                </div>)
        });
        return (
            <div className="inst">
                { measures }
            </div>
        )
    })

    let instOptions = this.state.insts.map((inst, index) => <option value={index}>{'inst'+index.toString()}</option>);

    return (
      <div className="App">
        <p>this is red!</p>
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
                <FormControl
                    componentClass="select"
                    inputRef={(ref) => {this.inputs.inst = ref}}
                >
                    { instOptions }
                </FormControl>
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
                <Button type="submit">create</Button>
            </FormGroup>
        </form>
        <p id="sizing">Viewport time: {(this.state.sizing/1000).toFixed(2)} seconds</p>
        <div id="workspace" onWheel={(e) => this.handleWheel(e)} className="workspace">
            { insts }
        </div>
      </div>
    );
  }
}

export default App;
