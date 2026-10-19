'use strict';
// Sample skiers (ported from the prototype's seedPeople). Only used when SEED_SAMPLE=1
// and the store is empty, so the slope is not bare during development.

const WHERE = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
const JACKETS = ['#E84A3B', '#F28C28', '#F2C200', '#2E8B57', '#2A62C9', '#7B4BE0', '#E0157F', '#1D1D1B'];
const HELMETS = ['#F7F9FC', '#1D1D1B', '#D7263D', '#F2C200', '#2A62C9', '#9AA7B8', '#F28C28', '#2E8B57'];
const RANGES = [[6, 20], [6, 13], [10, 14], [6, 14], [11, 13], [12, 12], [13, 20], [8, 15], [9, 13]];
const REL = {
  ams: ['Bestie from Amsterdam', 'Old flatmate, Amsterdam', 'From Amsterdam'],
  delft: ['Studied together in Delft', 'From Delft'],
  bansko: ['Future neighbour at Orbelus', 'Bansko local'],
  tw: ['Family', 'From Taiwan', 'Childhood friend, Taiwan'],
  nomad: ['Nomad friend', 'Startup friend', 'Met at Network School'],
  other: ['Colleague from Singapore']
};

function sampleSkiers() {
  let seed = 41;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rows = [
    ['Sanne', 'ams'], ['Joris', 'ams'], ['Femke', 'ams'], ['Daan', 'ams'], ['Lotte', 'ams'], ['Bram', 'ams'], ['Noor', 'ams'],
    ['Iris', 'delft'], ['Thijs', 'delft'], ['Eva', 'delft'], ['Sem', 'delft'],
    ['Elena', 'bansko'], ['Georgi', 'bansko'], ['Mira', 'bansko'], ['Ivo', 'bansko'], ['Kalina', 'bansko'],
    ['Yu-Ting', 'tw'], ['Wei', 'tw'], ['Hsin', 'tw'], ['Pei', 'tw'],
    ['Marco', 'nomad'], ['Aisha', 'nomad'], ['Lea', 'nomad'], ['Kenji', 'nomad'], ['Sofia', 'nomad'], ['Priya', 'other']
  ];
  const msgs = ['Happy 40th, Ting!', 'Finally skiing with you!', 'Saving you a seat in the sauna', 'First time on a board, wish me luck', 'Who wants vin chaud after?', 'Coming down for cake!', 'See you at the spa tonight', 'Race you to the bottom!', 'Bringing stroopwafels', 'Is that a mogul or a person?', 'Brb, falling gracefully', 'Ting, your pass is the best gift'];
  const count = {};
  return rows.map(([name, from], i) => {
    const local = from === 'bansko';
    const tr = r();
    const type = tr < 0.5 ? 'skier' : tr < 0.8 ? 'board' : 'walker';
    const [arrive, leave] = local ? [6, 20] : RANGES[Math.floor(r() * RANGES.length)];
    const where = local ? WHERE[1]
      : (leave - arrive >= 5 ? (r() < 0.7 ? WHERE[0] : WHERE[2])
        : (r() < 0.4 ? WHERE[0] : WHERE[1 + Math.floor(r() * 3)]));
    const n = count[from] = (count[from] || 0);
    count[from] += 1;
    return {
      name, from: [from], fromOther: from === 'other' ? 'Singapore' : '', parts: ['slope'],
      stay: leave - arrive >= 11 ? 'Two weeks' : leave === arrive ? 'Just the 12th' : 'One week', where,
      msg: type === 'walker' ? (r() < 0.5 ? 'Sorry, I only walk' : msgs[Math.floor(r() * msgs.length)]) : msgs[Math.floor(r() * msgs.length)],
      jacket: JACKETS[Math.floor(r() * JACKETS.length)], hat: HELMETS[Math.floor(r() * HELMETS.length)],
      type, rel: REL[from][n % REL[from].length], arrive, leave,
      pass: arrive <= 12 && leave >= 12 ? 'yes' : 'no', bag: i % 9 === 4
    };
  });
}

module.exports = { sampleSkiers };
