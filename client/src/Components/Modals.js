import React from 'react';
import { Container, Row, Col, Modal } from 'react-bootstrap';
import { Accordion, Button, Card } from 'react-bootstrap';
import { FormLabel, TBButton, TBDropdown } from 'bandit-lib';
import { mixins, colors } from 'bandit-lib';
import styled from 'styled-components';
import { primary, secondary, PPQ_OPTIONS } from '../config/CONFIG.json';
import { PPQ_explainer } from '../Util/help';

const StyledAccordion = styled(Accordion)`
    padding: 0px;
    width: 100%;

    .card {
        background-color: ${secondary};
        border: none;
        .card-header {
            padding: 2px;
            background-color: ${secondary};
            .btn {
                transition: all 0.2s;
                transition-timing-function: ease-out;
                &:hover {
                    color: ${colors.accent};
                    padding-left: 10px;
                }
                font-size: 0.75em;
                padding: 0px 6px 4px 6px;
                text-decoration: none;
                color: ${primary};
                ${mixins.font_mixin}
            }
        }
    }
`;

var StyledModal = styled(Modal)`
    .modal-content {
        border: none;
        border-radius: 0em;
    }
`;

var ModalHeader = styled(Modal.Header)`
    color: ${secondary}
    background-color: ${primary}
    border-radius: 0px;;
    font-size: 8pt;
    font-family: 'Helvetica', 'Arial', sans-serif;
    padding: 2px 10px;
    padding-right: 4px;
    .close, span {
        font-size: 8pt;
        text-shadow: none;
        color: ${secondary};
    }
`
    
var ModalBody = styled(Modal.Body)`
    border: none;
    background-color: ${secondary};
    padding: 4px 10px;
`;

var ModalButton = styled(TBButton)`
    padding: 2px 6px;
    margin: 0px 6px;
`;

var ServerModal = (props) => (
    <StyledModal 
      show={ props.show }
      size="md"
      onHide={ props.onHide }
      centered
    >
      <ModalHeader closeButton>
        - HARDWARE SETTINGS
      </ModalHeader>
      <Modal.Dialog 
        style={{ width: '300px' }}
        centered
      >
        <ModalBody>
            {props.children}
        </ModalBody>
      </Modal.Dialog>
    </StyledModal>
);

var ExportModal = (props) => (
    <StyledModal 
      show={ props.show }
      size="md"
      onHide={ props.onHide }
      centered
    >
      <ModalHeader closeButton>
        - EXPORT SETTINGS
      </ModalHeader>
      <Modal.Dialog 
        style={{ margin: '0px', width: '100%' }}
        centered
      >
        <ModalBody
            style={{ padding: '40px' }}
        >
            {props.children}
        </ModalBody>
      </Modal.Dialog>
    </StyledModal>
);

var WarningModal = (props) => (
    <StyledModal 
      show={ props.show }
      size="sm"
      onHide={ props.onHide }
      centered
    >
      <ModalHeader closeButton>
          { props.header }
      </ModalHeader>
      <ModalBody>
        <Container>
          <Row>
            { props.buttons.map((b, i) => (<Col className="text-center"><ModalButton key={i} onClick={b.onClick}>{b.text}</ModalButton></Col>)) }
          </Row>
        </Container>
      </ModalBody>
    </StyledModal>
); // unmounting bootstrap modals mean we can't use styled-components


const NewFileModal = (props) => {
    // this is copied directly from SettingsModal. how to dry this up?
    var tempo_ppqs = PPQ_OPTIONS.map((ppq, ind) => ({ eventKey: ind + 1, text: `${ppq[0]} (${ppq[1]})` }));
    var global_ppqs = [];
    var i = 1;
    while (i * props.settings.PPQ_tempo < 1024*16 && i < 20)
        global_ppqs.push(props.settings.PPQ_tempo * i++);

    return (
    <StyledModal 
      show={ props.show }
      size="md"
      onHide={ props.onHide }
      centered
    >
      <ModalHeader closeButton>
          { props.header }
      </ModalHeader>
      <ModalBody>
        <Container style={{ padding: '0px' }}>
          {/* need a filename in here */}
          <Row>
              <Col xs={4}><FormLabel>Tempo PPQ</FormLabel></Col>
              <Col xs={8}>
                  <TBDropdown
                      onSelect={(eventKey) => props.onTempoSelect(eventKey-1)}
                      toggle={props.settings.PPQ_tempo + ' (' + props.settings.PPQ_desc + ')'}
                      menuItems={tempo_ppqs}
                  />
              </Col>
          </Row>
          <Row>
              <Col xs={4}><FormLabel>Global PPQ</FormLabel></Col>
              <Col xs={8}>
                <TBDropdown
                    className="shadow-none"
                    onSelect={props.onPPQSelect}
                    toggle={props.settings.PPQ}
                    menuItems={global_ppqs.map(ppq => ({ eventKey: ppq, text: ppq }))}
                />
              </Col>
          </Row>
          <Row>
            <Col>
            <hr style={{ margin: '0px' }}/>
            <StyledAccordion>
              <Card>
                <Card.Header>
                  <Accordion.Toggle as={Button} variant="link" eventKey="0">
                    What do these settings mean?
                  </Accordion.Toggle>
                </Card.Header>
                <Accordion.Collapse eventKey="0">
                  <Card.Body>{PPQ_explainer}</Card.Body>
                </Accordion.Collapse>
              </Card>
            </StyledAccordion>
            <hr style={{ margin: '0px' }}/>
            </Col>
          </Row>
          <Row>
            { props.buttons.map((b, i) => (<Col className="text-center"><ModalButton key={i} onClick={b.onClick}>{b.text}</ModalButton></Col>)) }
          </Row>
        </Container>
      </ModalBody>
    </StyledModal>
  );
}

var WelcomeModal = (props) => 
    (<StyledModal 
      show={ props.show }
      size="md"
      onHide={ props.onHide }
      centered
    >
      <ModalHeader closeButton>
        <h3>Welcome to Bandit</h3>
      </ModalHeader>
      <Modal.Dialog 
        style={{ height: '100px' }}
        centered
      >
        <ModalBody>
            <p style={{color: 'black'}}>Bandit is a software/hardware ecosystem for managing complex time in music and sound design. If this is your first time, consider trying a brief tutorial on basic functions available <a style={{color: 'red'}} onClick={props.quickstart}>here</a>. This and other tutorials can be launched from the menu at the bottom of the screen.</p>
        </ModalBody>
      </Modal.Dialog>
    </StyledModal>);



var TutorialsModal = (props) => {

    let tuts = Object.keys(props.tuts).map((t, i) => (
        <Row key={i}>
            <Col xl={4}>
                <ModalButton
                    onClick={() => props.beginTut(t)}
                >{t}</ModalButton>
            </Col>
            <Col xl={8}>
                <p>{props.tuts[t].description}</p>
            </Col>
        </Row>
    ));
            
    return (
        <StyledModal
          show={ props.show }
          size="md"
          style={{ width: '100%' }}
          onHide={ props.onHideCallback }
          centered
        >
          <ModalHeader className="modalHeader" closeButton>
            - TUTORIALS
          </ModalHeader>
          <ModalBody>
              <Container>
                  {tuts}    
              </Container>
          </ModalBody>
        </StyledModal>
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
                <Col xs={4}><FormLabel>{setting.name}</FormLabel></Col>
                <Col xs={8}>{setting.body}</Col>
            </Row>
        </div>
    ));
    return (
        <StyledModal 
          show={ props.show }
          size="sm"
          onHide={ props.onHideCallback }
          centered
        >
          <ModalHeader closeButton>
            Preferences
          </ModalHeader>
          <ModalBody>
            <Container style={{ width: '300px' }}>{ settings }</Container>
          </ModalBody>
        </StyledModal>
    );
};

export { ExportModal, ServerModal, SettingsModal, WarningModal, NewFileModal, TutorialsModal, WelcomeModal };
