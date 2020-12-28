import React from 'react';
import { colors } from 'bandit-lib';


const bold_style = { color: colors.contrast };

const PPQ_explainer = (<>
    <p>Different softwares calculate tempo changes differently.</p>
    <p>Beginning with compatible <span style={bold_style}>Tempo PPQ</span> settings will give you the most accurate timing results for your project.</p>
    <p><span style={bold_style}>Global PPQ</span> governs the placement of midi events occurring on subdivisions of the beat. higher <span style={bold_style}>Global PPQ</span> means greater accuracy for smaller note divisions, at the expense of greater computational demand and possibly reduced performance. Lower <span style={bold_style}>Global PPQ</span> is a better choice if you aren't using Bandit for aligning subdivision events, and setting <span style={bold_style}>Global PPQ</span> to <span style={bold_style}>Tempo PPQ</span> is the most computationally performant.</p>
    <p>Changing either of these settings later will require changes in tempi to preserve important timing relationships; it is possible but not advised.</p>
</>)


export {
    PPQ_explainer,
}
