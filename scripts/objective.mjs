export const heldoutScore = (score) => score.heldout.coverage * 1000 + score.heldout.passRate * 100 - score.heldout.containerSecondsPerTask.repeat * 10;
