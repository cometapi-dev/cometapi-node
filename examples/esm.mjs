import { CometAPI } from "cometapi";

const client = new CometAPI();

const response = await client.responses.create({
  model: "gpt-5.6-sol",
  input: "Explain why the sky is blue in one sentence.",
});

console.log(response.output_text);

const stream = await client.chat.completions.create({
  model: "gpt-5.6-sol",
  messages: [{ role: "user", content: "Write one sentence about comets." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
process.stdout.write("\n");
