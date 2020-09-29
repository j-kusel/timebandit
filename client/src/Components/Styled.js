import React from 'react';
import styled from 'styled-components';
import { Dropdown, InputGroup } from 'react-bootstrap';

import { primary, primary_shadow, secondary } from '../config/CONFIG.json';
import c from '../config/CONFIG.json';

var font_mixin = `
    @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@500&display=swap');
    font-family: 'Work Sans', sans-serif;
`;

var button_mixin = `
    ${font_mixin}
    background-color: ${secondary};
    border: none;
    box-shadow: none;
    color: ${primary};
    text-align: center;    
    &:hover {
        text-shadow: 1px 1px 5px ${primary_shadow};
    }
`;

let timing = '0.3s';
var transition_mixin = ['transition', '-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}: ${timing};\n`, '');

// to use later
/*var transition_mixin2 = (change) => ['transition', '-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}: ${timing} ${change};\n`, '');
    */

let sliderThumb = `
    -webkit-appearance: none;
    border-radius: 1.3px 1.3px 0.5px 0.5px;
    appearance: none;
    height: 10px;
    width: 3px;
    cursor: pointer;
    margin-top: -8px;
    box-shadow: 1px 1px 1px #000000, 0px 0px 1px #0d0d0d;
    background: pink;
`;

let sliderTrack = `
    width: 100%;
    height: 2px;
    cursor: pointer;
    box-shadow: 1px 1px 1px #000000, 0px 0px 1px #0d0d0d;
    background: white;
    border-radius: 1.3px;
`;

var Slider = styled.input`
    -webkit-appearance: none;
    -moz-appearance: none;
    -ms-appearance: none;
    appearance: none;
    background: transparent;
    margin-left: 10px;
    outline: none;
    &:focus {
        outline: none;
    }

    ${['-webkit-slider-thumb', '-moz-range-thumb', '-ms-thumb']
        .map(prefix => `&::${prefix} { ${sliderThumb} }`)}
    ${['-webkit-slider-runnable-track', '-moz-range-track', '-ms-track']
        .map(prefix => `&::${prefix} { ${sliderTrack} }`)}
`;

var PanelHeader = styled.h3`
    font-size: 10px;
    border-bottom: 1px solid ${primary};
    width: 80%;
    margin-bottom: 4px;
`;

var InstInput = styled(InputGroup)`
    height: 20px;
    margin: 4px;
`;

var ArrowButton = styled.button`
    font-size: 8pt;
    background-color: ${secondary};
    border: 1px solid ${primary};
    padding: 0px 4px;
    height: 100%;
`;

var InstButton = styled.button`
    background: transparent;
    border: 0;
`;

var MixerArrow = styled.button`
    display: block;
    margin: -2px 0px -4px 0px;
    padding: 0px;
    border: none;
    background: transparent;
    text-decoration: none;
`;

var MixerRow = styled.tr`
    .arrows {
        visibility: hidden;
        width: 6px;
    }
    &:hover {
        .arrows {
            visibility: visible;
        }
    }
    .flip {
        transform: rotate(180deg);
    }
`;

var MixerButton = styled.button`
    box-sizing: border-box;
    border: 1px solid transparent;
    background-color: transparent;
    padding: 0px;
    min-width: 10px;
    width: 15px;
    align-items: center;
    justify-content: center;
    margin: auto;
    cursor: pointer;
    &:hover {
        border: 1px solid black;
    }
`

var Playback = styled.button`
    width: 50px;
    z-index: 50;
    height: ${c.PLAYBACK_HEIGHT + 'px'};
    position: absolute;
    left: ${props => props.x + 'px'}
    top: ${props => props.y + 'px'}
    padding-top: 0px;
    padding-bottom: 0px;
`;


var Panel = styled.div`
    position: absolute;
    background-color: ${secondary};
    text-align: center;    
    width: 100%;
    padding: 0px;
`;

var Pane = styled.div`
    position: absolute;
    width: ${c.PANES_WIDTH}px;
    left: ${props => props.x}px;
    top: ${props => props.y}px;
    height: ${props => props.height}px;
    border: none;
    z-index: 50;

    button {
        color: ${primary};
    }

    .closed {
        ${transition_mixin}
        position: absolute;
        left: 0px;
    }

    .opened {
        ${transition_mixin}
        position: absolute;
        left: 75px;
        transform: rotate(45deg);
    }
        
        
`;

var NewInst = styled(Pane)`
    width: initial;
    background-color: none;
    font-size: 10pt;
    color: ${secondary};
    input {
        border-bottom: 1px solid black;
    }
`;

var toolbar = styled(Pane)`
    padding: 10px;
    background-color: ${secondary};
    width: ${c.TOOLBAR_WIDTH}px;
    border: black solid 1px;
    color: red;
`;

var Metadata = styled(toolbar)`
    height: ${c.META_HEIGHT}px;
`;

var Rehearsal = styled(toolbar)`
    height: ${c.REHEARSAL_HEIGHT}px;
`;

var Log = styled(toolbar)`
    height: ${c.LOG_HEIGHT}px;
`;

var Footer = styled.div`
    ${font_mixin}
    .flavor {
        font-size: 48pt;
    }
    padding-left: ${c.FOOTER_PADDING}px;
`;

var AudioButton = styled.button`
    position: absolute;
    &.btn-group.btn {
        position: fixed;
    }
    margin: 0px;
    left: ${props => props.x}px;
    top: ${props => props.y}px;
    width: ${c.PANES_WIDTH}px;
    &:hover {
        width: ${c.PANES_WIDTH + 20}px;
    }
    padding: 0px;
    height: ${c.TRACK_HEIGHT/3}px;
    border: none;
    border-radius: 0px;
    background-color: #FFFFCC;
`;

var Ext = styled.a`
    text-decoration: none;
    margin: 5px;
    color: red;
    display: inline-block;
`;

let form_mixin = [
    font_mixin,
    `border: none;
    width: 48px;
    padding: 2px;
    font-size: 8pt;

    &:focus {
        outline: none;
        border: none;
    }

`].join('\n');

var TrackingBar = styled.div`
    position: absolute;
    height: ${c.TRACKING_HEIGHT}px;
    width: ${c.EDITOR_WIDTH}px;
    ${props => props.left ? `left: ${props.left}px;` : null}
    ${props => props.right ? `right: ${props.right}px;` : null}
    bottom: ${c.FOOTER_HEIGHT}px;
    
    z-index: 50;
`;

var Insert = styled.div`
    position: absolute;
    bottom: ${c.FOOTER_HEIGHT + c.TRACKING_HEIGHT}px;
    left: ${props => props.left}px;
    z-index: 50;

    button {
        ${button_mixin}
        ${form_mixin}
        width: 18px;
    }
`;

var Edit = styled.div`
    position: absolute;
    top: ${props => props.top}px;
    left: ${props => props.left}px;
    width: ${props => props.width}px;
    input {
        margin: 0px 6px;
        width: 28px;
        background-color: initial;
    }
    z-index: 50;
`;

const Link = ({ className, children }) => (
  <button className={className}>
    {children}
  </button>
);

const StyledLink = styled(Link)`
    color: red;
    font-weight: bold;
`;

const FormLabel = styled.label`
    color: black;
    ${form_mixin}
    font-size: 0.75em;
    font-weight: bold;
    width: 100px;
`;

const FormInput = styled.input`
    ${form_mixin}
    padding: 2px 4px;
    color: ${secondary};
    background-color: ${primary};
`;

var InstName = styled.h3`
    color: ${primary};
`;

var TBButton = styled.button`
    ${button_mixin}
    ${transition_mixin}
    &:hover {
        ${transition_mixin}
    }
    padding: 0px;
`;

var Module = styled.div`
    display: block;
    float: left;
    width: 250px;
    height: 100%;
`;

var Upload = styled(TBButton)`
    padding-right: 10px;
    font-size: 10px;
    height: 100%;
    &:focus {
        outline: none;
    }
`;

var Submit = styled(TBButton)`
    
    padding: 0px 4px;
    font-size: 10px;
    float: right;
    margin: ${2}px;
    &:focus {
        outline: none;
    }
`;

let transitions = (apply) => ['-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}-property: ${apply};\n`, '');

var Lock = styled.button`
    width: ${c.LOCK_HEIGHT}px;
    height: ${c.LOCK_HEIGHT}px;
    ${transitions('none')}
    border: none;
    border-left: 1px solid ${props => props.checked ? primary : secondary};
    color: ${props => props.checked ? primary : secondary};
    background-color: ${props => props.checked ? secondary : 'initial'};
    text-align: center;    
    &:focus {
        outline: none;
    }
`;


var TBddtoggle = styled(Dropdown.Toggle)`
    height: 40px;
    &.dropdown-toggle {
        ${button_mixin}
    }

    &.btn.btn-primary.dropdown-toggle {
        ${button_mixin}
        color: ${primary};
        background-color: ${secondary};
    };

    &.btn.btn-primary.dropdown-toggle:focus {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
    };

    &.btn.btn-primary.dropdown-toggle:hover {
    };

    &.btn.btn-primary.dropdown-toggle:active {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
    };
`;

var TBDropdown = styled(props => (
    <Dropdown 
 onSelect={props.onSelect}>
      <TBddtoggle>
        {props.toggle}  
      </TBddtoggle>
      <Dropdown.Menu>
        {/* props.menuItems.map(drop => (<Dropdown.Item key={drop.eventKey} eventKey={drop.eventKey}>{drop.text}</Dropdown.Item>))*/ }
        <Dropdown.Item>hello</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
))`
    &.toggle-dropdown {
        background-color: red;
    }
    color: red;
    padding: 5px 6px;
    border: none;
    border-radius: 0px;
    background-color: ${secondary};
    text-align: center;    
    width: 100%;
`;





export { Module, PanelHeader, Slider, MixerButton, ArrowButton, InstInput, InstButton, MixerArrow, MixerRow, NewInst, Link, StyledLink, FormInput, FormLabel, TrackingBar, Insert, Edit, Ext, Footer, Log, Rehearsal, Metadata, Upload, Submit, Playback, Panel, Pane, TBButton, AudioButton, InstName, Lock, TBDropdown };
