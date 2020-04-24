import React from 'react';
import { Container, Dropdown, Row, Col, Modal } from 'react-bootstrap';
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
          { props.buttons.map(b => (<ModalButton onClick={b.onClick}>{b.text}</ModalButton>)) }
        </ModalBody>
      </Modal.Dialog>
    </Modal>
); // unmounting bootstrap modals mean we can't use styled-components



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
    ].map(setting => (
        <div>
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

export { SettingsModal, WarningModal };
