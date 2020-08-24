#include <avr/io.h>
#include <avr/interrupts.h>
#include <util/delay.h>
#include "USART.h"

#define F_CPU 16000000
#define BAUD 9600
#define BAUD_RATE_CALC ((F_CPU/16/BAUD) - 1)
#define ONBOARD_LED 0b00100000

// change settings
/*int command(char byte) {
*/

int sustain = 150;

int trigger(char byte) {
    // store banks to turn off later
    char B_bank = 0b00000111 & byte;
    char C_bank = (0b11111000 & byte) >> 3;
    // toggle RX LED at C6
    C_bank ^= ONBOARD_LED;
    PORTB = B_bank;
    PORTC = C_bank;
    _delay_ms(sustain);
    PORTB = 0;
    PORTC = 0;
}

int param(char byte) {
    // sustain change
    if (byte & (1 << 7)) {
        int sus = 0;
        for (int i=0; i<8; i++) {
            if (byte & (1 << i)) {
                sus += pow(2, i);
            }
        }
        if (sus == 0) {
            sus = 150;
        }
        sustain = sus;
        return 1;
    }
}

int main(void) {
    // Data Direction Register B - enable output by writing a 1 to the bit
    // this is PB0?
    DDRB |= 0b00000111;
    DDRC |= 0b00111111;
    char command = 0x00;
    char serial = 0x00;

    UBRR0H = (BAUD_RATE_CALC >> 8);
    UBRR0L = BAUD_RATE_CALC;

    UCSR0B = (1 << TXEN0) | (1 << TXCIE0) | (1 << RXEN0) | (1 << RXCIE0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);

    while (1) {
        command = receiveByte();
        if (command === 0) {
            transmitByte(1);
            param(receiveByte());
        } else {
            trigger(receiveByte());
        }
    }
    return 0;
}
