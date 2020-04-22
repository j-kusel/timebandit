import React from 'react';
import styled from 'styled-components';
import { Col, ToggleButton, Dropdown } from 'react-bootstrap';

import { TRACK_HEIGHT, primary, secondary } from '../config/CONFIG.json';

var Playback = styled.button`
    background-color: ${props => props.status === "true" ? 'green' : 'gray'};
`;

var Panel = styled(({ className, children }) => (<Col className={className} xs={2}>{children}</Col>))`
    background-color: ${secondary};
    text-align: center;    
    width: 100%;
    padding: 0px;
`;

var Pane = styled.div`
    height: ${TRACK_HEIGHT}px;
    border: 1px solid black;
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
    background-color: ${secondary};
    color: ${primary};
    text-align: center;    
    width: 100%;
    padding: 0px;
`;

var Upload = styled(TBButton)``;

var TBToggle = styled(ToggleButton)`
    padding: 5px 6px;
    border: none;
    border-radius: 0px;
    background-color: ${secondary};
    text-align: center;    
    width: 100%;
`;

var TBddtoggle = styled(Dropdown.Toggle)`
    &.btn-primary {
        background-color: red;
        transition-property: none;
    };
    &.btn-primary:focus {
        background-color: red;
        transition-property: none;
    };
    &.btn-primary:hover {
        background-color: red;
        transition-property: none;
    };
    &.btn-primary:active {
        background-color: red;
        transition-property: none;
    };
`;

var TBDropdown = styled(props => (
    <Dropdown 
 onSelect={props.onSelect}>
      <TBddtoggle>
        {props.toggle}  
      </TBddtoggle>
      <Dropdown.Menu>
        { props.menuItems.map(drop => (<Dropdown.Item eventKey={drop.eventKey}>{drop.text}</Dropdown.Item>)) }
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
