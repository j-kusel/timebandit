import React from 'react';
import { Container, Row, Col, Modal } from 'react-bootstrap';
import { TBButton, TBDropdown } from './Styled';
import styled from 'styled-components';
import { PPQ_OPTIONS } from '../config/CONFIG.json';

var ModalBody = styled(Modal.Body)`
    border: none;
    color: red;
`;

var ModalButton = props => (
    <TBButton onClick={props.onClick}>{props.children}</TBButton>
);

var WarningModal = (props) => (
    <Modal 
      show={ props.show }
      size="sm"
      onHide={ props.onHide }
      centered
    >
      <Modal.Header closeButton>
          { props.body }
      </Modal.Header>
      <Modal.Dialog 
        style={{ height: '100px' }}
        centered
      >
        <ModalBody>
          { props.buttons.map((b, i) => (<ModalButton key={i} onClick={b.onClick}>{b.text}</ModalButton>)) }
        </ModalBody>
      </Modal.Dialog>
    </Modal>
); // unmounting bootstrap modals mean we can't use styled-components

var WelcomeModal = (props) => 
    (<Modal 
      show={ props.show }
      size="md"
      onHide={ props.onHide }
      centered
    >
      <Modal.Header closeButton>
        <h3>Welcome to Bandit</h3>
      </Modal.Header>
      <Modal.Dialog 
        style={{ height: '100px' }}
        centered
      >
        <ModalBody>
            <p style={{color: 'black'}}>Bandit is a software/hardware ecosystem for managing complex time in music and sound design. If this is your first time, consider trying a brief tutorial on basic functions available <a style={{color: 'red'}} onClick={props.quickstart}>here</a>. This and other tutorials can be launched from the menu at the bottom of the screen.</p>
        </ModalBody>
      </Modal.Dialog>
    </Modal>);



var TutorialsModal = (props) => {

    let tuts = [
        'quickstart',
        'other',
    ].map((t, i) => (
        <ModalButton
            key={i}
            onClick={() => props.beginTut(t)}
        >{t}</ModalButton>
    ));
            
    return (
        <Modal
          show={ props.show }
          size="md"
          style={{ width: '100%' }}
          onHide={ props.onHideCallback }
          centered
        >
          <Modal.Header closeButton>
            Tutorials
          </Modal.Header>
          <Modal.Dialog 
            style={{ height: '100px' }}
            centered
          >
            <ModalBody>
                {tuts}    
            </ModalBody>
          </Modal.Dialog>
        </Modal>
    );
};

var SettingsModal = (props) => {
    var tempo_ppqs = PPQ_OPTIONS.map((ppq, ind) => ({ eventKey: ind, text: `${ppq[0]} (${ppq[1]})` }));

    var settings = [
        {
            name: 'Tempo PPQ',
            body: <TBDropdown
                onSelect={props.onTempoSelect}
                toggle={props.settings.PPQ_tempo + ' (' + props.settings.PPQ_desc + ')'}
                menuItems={tempo_ppqs}
            />,
        }, {
            name: 'PPQ',
            body: <TBDropdown
                className="shadow-none"
                onSelect={props.onPPQSelect}
                toggle={props.settings.PPQ}
                menuItems={[
                    { eventKey: 256, text: 256 },
                    { eventKey: 96, text: 96 },
                    { eventKey: 24, text: 24 },
                ]}
            />,
        }
    ].map((setting, ind) => (
        <div key={ind}>
            <Row>
                <Col xs={4}><span>{setting.name}</span></Col>
                <Col xs={8}>{setting.body}</Col>
            </Row>
        </div>
    ));
    return (
        <Modal 
          show={ props.show }
          size="lg"
          style={{ width: '100%' }}
          onHide={ props.onHideCallback }
          centered
        >
          <Modal.Header closeButton>
            Preferences
          </Modal.Header>
          <Modal.Dialog 
            style={{ height: '100px' }}
            centered
          >
            <ModalBody>
              <Container>{ settings }</Container>
            </ModalBody>
          </Modal.Dialog>
        </Modal>
    );
};

export { SettingsModal, WarningModal, TutorialsModal, WelcomeModal };
