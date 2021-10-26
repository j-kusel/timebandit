import uuidv4 from 'uuid/v4';
import { MeasureCalc } from './index';

/**
 * A class for parsing debugging text to the P5js Canvas
 */
export class Parser {
    /**
     * Spawns a block of text for monitoring standard and custom variables during debugging
     * @param {PPQ} - Parts Per Quaver used by the App
     * @param {PPQ_tempo} - Tempo Parts Per Quaver used by the App
     */
    constructor(PPQ, PPQ_tempo) {
        this.PPQs = { PPQ, PPQ_tempo };
    }

    /**
     * Parse an input JSON file into instruments and measures 
     * @param {Object} input - JSON object containing score information
     * @returns {Array} Array of instruments
     */
    parse(input) {
        // add meta section for manually overriding PPQ etc.
        return input.map((inst, ind) => {
            let measures = inst.measures.reduce((acc, meas) => {
                let id = uuidv4();
                return Object.assign(acc, {
                    [id]: {
                        ...MeasureCalc(meas, this.PPQs),
                        id, inst: ind, beat_nodes: [], locks: {}, schemas: {}, schemaIds: [], events: []
                    }
                });
            }, {});
            return ({ name: inst.name, measures, audioId: uuidv4() });
        });
    }
}
