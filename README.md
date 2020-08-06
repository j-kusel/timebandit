## Bandit
Bandit is a software/hardware ecosystem and standardization proposal for sketching, notating, and performing polytemporal music.

- [Stealing Time - a conceptual introduction](#stealing-time-a-conceptual-introduction)
    - [How do we define time?](#how-do-we-define-time) 

### Stealing Time - a conceptual introduction
For all intents and purposes, support for multiple tempi in contemporary DAWs and notation software is nonexistent. After sections are notated in conventional software, scores may be painfully cobbled together from vector file exports, but this destructive editing process makes mistakes tedious and costly to fix. Handwritten or CAD approaches can keep composers from fighting with opinionated software alignment when working with asynchronous time, but calculating rhythms by hand is a drudgery to which few would voluntarily commit. Timing compatibility between software for even as simple an example as an ensemble accelerando becomes a feat, much less dealing with tempo changes in performance between musicians or MIDI devices. What if these deterrents were removed?<br>

**Bandit** intends to provide a composition and performance toolkit for the management of time both in the abstract and concrete. Its purpose is not to replace the software suites for notation and performance with which you're already familiar, but rather to integrate into their workflow and reveal and ameliorate their deficiencies in the realm of tempo.

#### How do we define time?
- A duration of unchanging tempo, whether a measure or a full piece, can be said to be in __constant time__. Calculating constant time in milliseconds is as easy as dividing 60000 by the tempo in beats per minute and multiplying by the number of beats:<br>
<img src="https://render.githubusercontent.com/render/math?math=\delta=60000/t*b"><br>
For one bar of 5/4 at 60 BPM, this equates to `60000/60 * 5 = 5000ms`.

- Definitions quickly become murky once a second-order term is introduced. __Changing time__ introduces a tempo change with well-defined beginning and ending points, but also demands clarity depending on how frequently this change occurs. Let's first naively assume a continuous function for one bar of 5/4 moving from 60 to 120 BPM. This passage of time can be modeled as an integral dependent on starting tempo __s__, slope __i__, and time signature __b__:<br>
<img src="https://render.githubusercontent.com/render/math?math=\int_{0}^{b} 60000/(ix/b+s) dx"><br>
<img src="https://render.githubusercontent.com/render/math?math=\int_{0}^{b} 60000/((120-60)x/b+60) dx=3465.7"><br>
The result is around 3466ms. This can be said to be the __true time__ of the measure in question, but its usefulness is quickly brought into question. Let's say we're sending MIDI information between two devices, one byte at a time at 31.25 kbit/s. By the time the second tempo event byte is sent, the tempo has increased marginally but continuously beyond 60 BPM, but the protocol is limited by its granular nature. Tempo can only be communicated via stepwise, instantaneous changes, and will lag behind the true time of the measure in accelerating cases or rush ahead during decelerations.

- True time could hypothetically be used in composition without imposing the granular limitations of software (and indeed has been for millennia), but its standardization demands much from conductors, performers, and other analogue-minded devices, as well as an inconvenient computational and mathematical overhead for the composer when manipulating materials. An appropriate compromise is __quavered time__, a piecewise function already in haphazard use by music software. Programs will have either a fixed or variable number of __parts per quaver__ (also "pulses per quarter", "ticks per quarter", &c, henceforth **PPQ**) expressing the granularity of their MIDI functions for playback. Often, this is a finer granularity than the ticks used to express tempo changes. Take for example Ableton Live - its tick resolution is a behemoth 960 PPQ, but some simple tempo ramp tests reveal it updates tempo a paltry four times per beat. This may be expressed in summation notation as the accumulation of slices of constant time, dependent on starting tempo __s__, slope __i__, time signature __b__, and tempo resolution (PPQ) __p__:<br>
<img src="https://render.githubusercontent.com/render/math?math=$$\sum_{t=0}^{b*p-1} 60000/p/(s + it/(b*p))$$"><br>
<img src="https://render.githubusercontent.com/render/math?math=$$\sum_{t=0}^{5*4-1} 60000/p/(60 + 60t/(5*4)) \approx 3529.02$$"><br>
In quavered time at a PPQ of 4, the sum of 3529ms exceeds the comparable true time by 63ms. Higher PPQs allow a tradeoff between computational cost and greater fidelity with respect to true time, but compatibility with other software and devices should always be considered.






