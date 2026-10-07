'use strict';
// Sample skiers (ported from the prototype's seedPeople). Only used when SEED_SAMPLE=1
// and the store is empty, so the map is not bare during development.

const STAY = ['The whole month', 'Two weeks', 'One week', 'Just the 12th'];
const WHERE = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
const JACKETS = ['#6C171E', '#4F74B3', '#1F5560', '#D9A23A', '#9E3F6E', '#1D1D1B', '#F1F5FA', '#C8D63A'];

function sampleSkiers() {
  let seed = 19;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const names = ['Sanne', 'Joris', 'Femke', 'Daan', 'Lotte', 'Bram', 'Noor', 'Ruben', 'Iris', 'Thijs', 'Eva', 'Sem', 'Floor', 'Lieke', 'Elena', 'Georgi', 'Mira', 'Pavel', 'Ivo', 'Kalina', 'Dimitar', 'Stefan', 'Yu-Ting', 'Wei', 'Hsin', 'Kai', 'Pei', 'Mei', 'Marco', 'Aisha', 'Tom', 'Lea', 'Kenji', 'Sofia', 'Nadia', 'Felix'];
  const plan = ['ams','ams','ams','ams','ams','ams','ams','ams','delft','delft','delft','delft','delft','delft','bansko','bansko','bansko','bansko','bansko','bansko','bansko','bansko','tw','tw','tw','tw','tw','tw','nomad','nomad','nomad','nomad','nomad','other','other','nomad'];
  const msgs = ['Finally skiing with you!', 'Bringing stroopwafels for the slope.', 'Who wants to share a ride from Sofia?', 'First time on skis. Be gentle.', 'Sauna every night, please.', 'Happy 40th in advance!', 'Saving you a seat at the spa.', 'Up for a sunrise run before the lifts?', 'Can someone teach me to snowboard?', 'Coworking buddy wanted for week two.'];
  const hats = ['#1D1D1B', '#F1F5FA', '#6C171E', '#D9A23A', '#4F74B3'];
  const others = ['Singapore', 'Vietnam'];
  let oi = 0;
  return names.map((n, i) => {
    const local = plan[i] === 'bansko';
    const from = [plan[i]];
    if (i % 7 === 3) from.push(plan[i] === 'nomad' ? 'tw' : 'nomad');
    const stay = local ? 'The whole month' : STAY[Math.floor(r() * 4)];
    const where = local ? 'My own place in Bansko'
      : (stay === 'Just the 12th' ? (r() < 0.5 ? 'A hotel in town' : 'Still deciding')
        : (r() < 0.65 ? 'Valentina Heights' : WHERE[1 + Math.floor(r() * 3)]));
    const parts = [];
    if (where === 'Valentina Heights') parts.push('colive');
    parts.push('slope');
    if (r() < 0.7) parts.push('spa');
    return {
      name: n, from, fromOther: plan[i] === 'other' ? others[oi++ % 2] : '', parts, stay, where,
      msg: msgs[Math.floor(r() * msgs.length)], jacket: JACKETS[Math.floor(r() * JACKETS.length)], hat: hats[Math.floor(r() * hats.length)]
    };
  });
}

module.exports = { sampleSkiers };
