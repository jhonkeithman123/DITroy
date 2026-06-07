import { parse } from '../layers/core/src/nlp/index.ts';

async function run(){
  const samples = [
    "who are you",
    "Hello there",
    "what time is it",
    "convert 10 km to mi",
    "2+2*3",
    "tell me a joke",
    "I have a bug in my code",
  ];
  const thinkMs = Number(process.env.DITROY_THINK_MS) || 2000;
  const smartEnabled = process.env.DITROY_SMART === '1' || process.env.DITROY_SMART === 'true' || process.env.DITROY_SMART === undefined;

  for(const s of samples){
    console.log('INPUT:', s);
    // show sync parse
    const sync = parse(s, { smart: false });
    console.log('SYNC:', sync);

    // show smart/async parse
    const asyncRes = await parse(s, { smart: smartEnabled, thinkMs });
    console.log('ASYNC:', asyncRes);

    console.log('---');
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
