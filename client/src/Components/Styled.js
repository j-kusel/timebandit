import React from 'react';
import styled from 'styled-components';
import { Dropdown } from 'react-bootstrap';

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
var transition_mixin2 = (change) => ['transition', '-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}: ${timing} ${change};\n`, '');


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
        background-color: initial;
        border: 0;
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
    border-bottom: solid 1px ${secondary};
    width: 48px;
    padding: 2px;
    margin: 4px;
    font-size: 8pt;

    &:focus {
        outline: none;
        border: none;
        border-bottom: solid 1px ${secondary};
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
    bottom: ${c.TRACKING_HEIGHT}px;
    left: ${props => props.left}px;
    z-index: 50;
`;

const Link = ({ className, children }) => (
      <a className={className}>
        {children}
      </a>
);

const StyledLink = styled(Link)`
    color: red;
    font-weight: bold;
`;

const FormInput = styled.input`
    ${form_mixin}
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

var Upload = styled(TBButton)`
    height: 40px;
    padding-left: 10px;
    &:focus {
        outline: none;
    }
`;

let transitions = (apply) => ['-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}-property: ${apply};\n`, '');

var Lock = styled.button`
    width: ${c.TRACKING_HEIGHT}px;
    height: ${c.TRACKING_HEIGHT}px;
    ${transitions('none')}
    border: none;
    border-left: 1px solid ${props => props.checked ? primary : secondary};
    color: ${props => props.checked ? primary : secondary};
    background-color: ${props => props.checked ? secondary : primary};
    text-align: center;    
    &:focus {
        outline: none;
    }
`;


var TBddtoggle = styled.div`
    height: 40px;
    &.dropdown-toggle {
        ${button_mixin}
    }

    &.btn.btn-primary.dropdown-toggle {
        ${button_mixin}
        color: ${primary};
        background-color: ${secondary};
        ${transitions('none')}
    };

    &.btn.btn-primary.dropdown-toggle:focus {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
        ${transitions('none')}
    };

    &.btn.btn-primary.dropdown-toggle:hover {
        ${transitions('none')}
    };

    &.btn.btn-primary.dropdown-toggle:active {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
        ${transitions('none')}
    };
`;

var TBDropdown = styled(props => (
    <Dropdown 
 onSelect={props.onSelect}>
      <TBddtoggle>
        {props.toggle}  
      </TBddtoggle>
      <Dropdown.Menu>
        { props.menuItems.map(drop => (<Dropdown.Item key={drop.eventKey} eventKey={drop.eventKey}>{drop.text}</Dropdown.Item>)) }
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





export { NewInst, Link, StyledLink, FormInput, TrackingBar, Insert, Edit, Ext, Footer, Log, Rehearsal, Metadata, Upload, Playback, Panel, Pane, TBButton, AudioButton, InstName, Lock, TBDropdown };
