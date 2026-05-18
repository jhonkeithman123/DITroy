export const responses: Record<string, string[]> = {
  greet: [
    "Hello — I'm DITroy. How can I help you today?",
    "Hi there! DITroy at your service.",
    "Greetings! What's on your mind today?"
  ],
  help: [
    'I can answer simple questions, tell jokes, or keep a short conversation. Try: "tell me a joke".',
    'Need assistance? I am here to chat, joke around, or just listen.',
    "I'm a simple bot right now. Try saying hello, asking for a joke, or saying goodbye!"
  ],
  joke: [
    "Why did the developer go broke? Because he used up all his cache.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem."
  ],
  goodbye: [
    "Goodbye — talk later!",
    "See you next time!",
    "Catch you later. Shutting down processors..."
  ],
  thanks: [
    "You're welcome!",
    "No problem at all.",
    "Glad I could help!"
  ],
  identity: [
    "I'm DITroy, DITris's assistant. How can I help?",
    "DITroy here — your DITris assistant.",
    "I'm DITroy, a small assistant built for DITris."
  ],
  status: [
    "I'm here and ready to help.",
    "Just keeping the systems warm. What's up?",
    "Standing by — what do you need?"
  ],
  wellbeing: [
    "I'm doing well. How about you?",
    "All good here. How are you?",
    "Feeling sharp — thanks for asking."
  ],
  math: [
    "Let me calculate that.",
    "Working on the math.",
    "Crunching the numbers."
  ],
  time: [
    "Let me check the time.",
    "Checking the current time.",
    "Let me see what time it is."
  ],
  date: [
    "Let me check today's date.",
    "Checking the date now.",
    "Let me see the date."
  ],
  weather: [
    "I can look up the weather for you.",
    "Let me check today's weather.",
    "I'll look up the forecast."
  ],
  convert: [
    "Let me convert that.",
    "Working on the conversion.",
    "Converting the units now."
  ],
  unknown: [
    "Sorry, I didn't understand that. Can you rephrase?",
    "My logic circuits lack a response for that. Care to try again?",
    "I'm not quite sure what you mean."
  ],
};

export function respond(intent: string, context: Record<string, any> = {}) {
  if (intent === "math") {
    if (typeof context.mathResult === "number") {
      return `The answer is ${context.mathResult}.`;
    }
    return "I can see a math expression, but I couldn't evaluate it.";
  }
  if (intent === "time") {
    const now = context.now instanceof Date ? context.now : new Date();
    return `It's ${now.toLocaleTimeString()}.`;
  }
  if (intent === "date") {
    const now = context.now instanceof Date ? context.now : new Date();
    return `Today's date is ${now.toLocaleDateString()}.`;
  }
  if (intent === "convert") {
    const conv = context.conversion;
    if (conv && typeof conv.result === "number") {
      return `${conv.value} ${conv.from} is ${conv.result.toFixed(2)} ${conv.to}.`;
    }
    return "I can convert units like C/F, cm/in, m/ft, and km/mi.";
  }
  const options = responses[intent] || responses.unknown;
  const index = Math.floor(Math.random() * options.length);
  let text = options[index];

  // Dynamic interpolation based on context
  if (context.timeOfDay) {
    text = text.replace("Hello", `Good ${context.timeOfDay}`);
  }

  return text;
}
