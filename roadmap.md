## Plan: DITroy v1 Console (JavaScript)

Deliver a v1 console assistant in JavaScript with a clean modular layout (NLP, dialogue, personality stubs) and a working CLI loop. Focus on a single-repo, single-app build that matches your roadmap but stays lightweight for solo execution.

### Steps

1. Confirm v1 scope and JS runtime choice (Node.js), plus minimal dependencies and testing approach.
2. Define the v1 module boundaries (NLP, dialogue, personality) and decide the smallest viable interfaces between them.
3. Set up the initial repository structure for v1 (core modules, console interface, tests, docs) and a basic entry point.
4. Implement the console loop (read input, route to dialogue, return response) with a placeholder NLP pipeline.
5. Implement a simple rule-based dialogue engine with a tiny intent map and in-process context memory.
6. Add a minimal personality layer that decorates responses (tone and identity) without deep logic.
7. Add unit tests for intent parsing and dialogue routing; add a simple manual test script for the console loop.
8. Write a short README and update the roadmap doc to reflect v1 assumptions and next steps.

### Relevant files

- DITroy_structure_plan.md - align v1 scope with the existing roadmap and responsibilities

### Verification

1. Run the console app and confirm input -> response behavior for 5+ sample intents.
2. Run unit tests for NLP intent parsing and dialogue routing.
3. Validate that personality decoration can be toggled or adjusted without breaking dialogue logic.

### Decisions

- Tech stack: JavaScript on Node.js for v1
- Scope: v1 console only, solo workflow, include scaffolding tasks

### Further considerations

1. Minimal testing setup: built-in Node test runner vs. Jest - recommend Node test runner for lowest overhead.
2. Future GUI path: keep interfaces modular so a web or desktop UI can be added without changing core logic.
