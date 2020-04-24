import React from 'react';
import styled from 'styled-components';
import { Col, ToggleButton, Dropdown } from 'react-bootstrap';

import { PLAYBACK_HEIGHT, TRACK_HEIGHT, primary, primary_shadow, secondary } from '../config/CONFIG.json';

var button_mixin = `
    @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@500&display=swap');
    background-color: ${secondary};
    border: none;
    box-shadow: none;
    color: ${primary};
    font-family: 'Work Sans', sans-serif;
    text-align: center;    
    &:hover {
        text-shadow: 1px 1px 5px ${primary_shadow};
    }
`;

let timing = '0.3s';
var transition_mixin = ['transition', '-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}: ${timing};\n`, '');

var Playback = styled.button`
    width: 100%;
    height: ${PLAYBACK_HEIGHT};
    padding-top: 0px;
    padding-bottom: 0px;
`;

var Panel = styled(({ className, children }) => (<Col className={className} xs={2}>{children}</Col>))`
    background-color: ${secondary};
    text-align: center;    
    width: 100%;
    padding: 0px;
`;

var Pane = styled.div`
    height: ${TRACK_HEIGHT}px;
    border: none;
`;

var AudioButton = styled(ToggleButton)`
    display: inline;
    border: 1px solid black;
    border-radius: 2px;
    background-color: #FFFFCC;
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
    width: 100%;
    padding: 0px;
`;

var Upload = styled(TBButton)`
    height: 40px;
    &:focus {
        outline: none;
    }
`;

let transitions = (apply) => ['-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition']
    .reduce((acc, t) => `${acc}${t}-property: ${apply};\n`, '');

var TBToggle = styled(ToggleButton)`
    ${transitions('none')}
    &.btn {
        padding-top: 0.5rem;
        border-radius: 0px;
        height: 40px;
    }

    &.btn.btn-primary.dropdown-toggle {
        border: none;
        border-radius: 0px;
    }

    &.btn.btn-primary {
        ${button_mixin}
        ${transitions('none')}
    };

    &.btn.btn-primary.active {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
        ${transitions('none')}
    };

    &.btn.btn-primary:focus {
        ${button_mixin}
        ${transitions('none')}
    };

    &.btn.btn-primary:hover {
        ${transitions('none')}
    };

    &.btn.btn-primary:active {
        ${button_mixin}
        color: ${secondary};
        background-color: ${primary};
        ${transitions('none')}
    };

    text-align: center;    
    width: 100%;
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





export { Upload, Playback, Panel, Pane, TBButton, AudioButton, InstName, TBToggle, TBDropdown };
