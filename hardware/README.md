## Bandit hardware

- [Overview](#overview)
- [Flashing the chip](#flashing-the-chip)
    - [Bootloader](#bootloader)
    - [Software](#software)
        - [Linux](#linux)
        - [Mac/Windows](#mac-windows)

### Overview

The Bandit board is a USB-powered, open-hardware metronome with up to eight channels for controlling the [SparkFun ROB-08449](https://www.mouser.com/ProductDetail/SparkFun/ROB-08449?qs=WyAARYrbSnZj6jJCAHtRrQ%3D%3D) vibration motor. As hardware files are updated, two versions will be maintained to minimize cost and maximize accessibility - one making use of [JLCPCB](https://jlcpcb.com/)'s surface-mount component service (more expensive) and one which requires you to source your own components (more soldering required). As of the time of this writing, JLCPCB does not offer an SMD micro-USB port component, which can be difficult to solder; future versions may include optional headers for accessing the pins directly.

Building and flashing the chip requires some unavoidable soldering experience and familiarity with the command line. You are encouraged to print and build the boards and wearables yourself, but if any of these steps are major obstacles to actually using the software in a live capacity, just message me and we'll work something out.

This folder contains versions of the Bandit board schematic/BOM/gerber files and software updates for flashing the onboard ATMega328p, and will later include sewing patterns for vibration motor wearables. Both software and hardware patches are detailed in the version folders.

### Flashing the chip

#### Bootloader

The current board design uses a surface-mount AVR chip, which ships without the required bootloader software. The easiest way I've found to flash the bootloader is with an Arduino acting as an ISP, as outlined [here](https://www.arduino.cc/en/Tutorial/ArduinoToBreadboard). There is a four-pin header in the center of the board providing SCK, MOSI, MISO, and reset connections for this purpose.

#### Software

The flashing process and Makefiles for this project are based on [Elliot Williams](https://github.com/hexagon5un)' excellent _Make: AVR Programming_ book, the source files for which are hosted [here](https://github.com/hexagon5un/AVR-Programming); I wouldn't know a thing about AVR chips without him!

##### Linux

You will need the following packages to build and flash the software:
```
sudo apt-get install avrdude avrdude-doc binutils-avr avr-libc gcc-avr gdb-avr
```

With the same Arduino connection setup as outlined in the article above, simply run the command `make flash` in the desired version folder and avrdude will work its magic.

##### Mac/Windows
Guides coming soon!



