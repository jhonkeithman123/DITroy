import { runConsole, handleOnce } from "@ditroy/interfaces";

if (process.argv.includes("--demo")) {
  (async () => {
    const samples = [
      "hello",
      "can you help me",
      "tell me a joke",
      "thanks",
      "bye",
    ];
    for (const s of samples) {
      const r = await handleOnce(s);
      console.log("> " + s);
      console.log(r + "\n");
    }
    process.exit(0);
  })();
} else {
  runConsole();
}
