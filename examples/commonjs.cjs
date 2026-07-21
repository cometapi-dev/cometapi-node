const { CometAPI } = require("cometapi");

const client = new CometAPI();

async function main() {
  const completion = await client.chat.completions.create({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Reply with one short greeting." }],
  });
  console.log(completion.choices[0]?.message?.content ?? "");

  const models = await client.models.list();
  for (const model of models.data) {
    console.log(model.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
