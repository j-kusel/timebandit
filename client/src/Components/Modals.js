import React from 'react';
import { Modal } from 'react-bootstrap';
import styled from 'styled-components';

var WarningModal = styled((props) => (
    <Modal 
      show={ props.show }
      onHide={ props.onHide }
    >
      <Modal.Header closeButton>
      </Modal.Header>
      <Modal.Dialog centered>
        <Modal.Body>
          { props.body }
        </Modal.Body>
        <Modal.Footer>
          { props.footer }
        </Modal.Footer>
      </Modal.Dialog>
    </Modal>
))`
    height: 100px;
`;

export { WarningModal };
