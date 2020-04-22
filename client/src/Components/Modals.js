import React from 'react';
import { Modal } from 'react-bootstrap';
import { TBButton } from './Styled';
import styled from 'styled-components';

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

export { WarningModal };
