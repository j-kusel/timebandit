#include <avr/io.h>
#include <util/delay.h>
#include "USART.h"

#define F_CPU 16000000
#define BAUD 9600
#define BAUD_RATE_CALC ((F_CPU/16/BAUD) - 1)

int main(void) {
    // Data Direction Register B - enable output by writing a 1 to the bit
    // this is PB0?
    DDRB |= 0b00000111;
    DDRC |= 0b00111111;
    char serialCharacter = 0x00;

    UBRR0H = (BAUD_RATE_CALC >> 8);
    UBRR0L = BAUD_RATE_CALC;

    UCSR0B = (1 << TXEN0) | (1 << TXCIE0) | (1 << RXEN0) | (1 << RXCIE0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);

    while (1) {
        serialCharacter = receiveByte();
        if (serialCharacter) {
            PORTC ^= 0b00100000;
        }
        PORTB = 0b00000111;
        PORTC = 0b00111111;
        _delay_ms(500);
        PORTB = 0b00000000;
        PORTC = 0b00000000;
        _delay_ms(500);
    }
    return 0;
}
