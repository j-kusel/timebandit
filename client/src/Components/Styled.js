import React from 'react';
import styled from 'styled-components';
import { Col, ToggleButton } from 'react-bootstrap';

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

var Upload = styled.button`
    background-color: ${secondary};
    color: ${primary};
    text-align: center;    
    width: 100%;
    padding: 0px;
`;


    

export { Upload, Playback, Panel, Pane, AudioButton, InstName };
