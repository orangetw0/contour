// A timer that browsers don't slow down in hidden tabs. The page advances the simulation on each tick while hidden.
setInterval(() => postMessage(0), 250);
