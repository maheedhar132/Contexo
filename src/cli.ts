import { Command } from "commander";
import kleur from "kleur";
import { saveCommand } from "./commands/save.js";
import { sessionsList, sessionShow, sessionDelete } from "./commands/sessions.js";
import { handoffCommand } from "./commands/handoff.js";
import { estimateCommand } from "./commands/estimate.js";
import { budgetRun, budgetSet, budgetShow } from "./commands/budget.js";
import { startMcpServer } from "./mcp.js";
import type { HarnessId } from "./adapters/index.js";
import type { ModelId } from "./cost.js";

const program = new Command();

program
  .name("portal")
  .description("Portable AI context and cost control across every AI coding harness.")
  .version("0.1.0");

program
  .command("save")
  .description("Save the current context as a Portal session")
  .option("-n, --name <name>", "Session name")
  .option("-f, --file <path>", "Read context from file")
  .option("-t, --text <text>", "Inline context string")
  .option("-m, --model <model>", "Model for token counting", "claude-sonnet-4-5")
  .action(async (opts) => {
    await saveCommand({
      name: opts.name,
      file: opts.file,
      text: opts.text,
      model: opts.model as ModelId,
    });
  });

program
  .command("sessions")
  .description("List recent sessions")
  .action(() => sessionsList());

program
  .command("show <id>")
  .description("Show a session (accepts id prefix)")
  .action((id: string) => sessionShow(id));

program
  .command("delete <id>")
  .description("Delete a session (accepts id prefix)")
  .action((id: string) => sessionDelete(id));

program
  .command("handoff <target>")
  .description("Hand off latest (or --session) context to another harness: claude-code | codex | cursor")
  .option("-s, --session <id>", "Session id or prefix")
  .option("--api-key <key>", "Anthropic API key (falls back to ANTHROPIC_API_KEY)")
  .option("--skip-compression", "Write raw context without compressing")
  .action(async (target: string, opts) => {
    if (!isHarness(target)) exitBadTarget(target);
    await handoffCommand(target, {
      session: opts.session,
      apiKey: opts.apiKey,
      skipCompression: opts.skipCompression,
    });
  });

program
  .command("estimate")
  .description("Estimate the token cost of a prompt before sending it")
  .option("-f, --file <path>", "Read text from file")
  .option("-t, --text <text>", "Inline text")
  .option("-m, --model <model>", "Model", "claude-sonnet-4-5")
  .option("--expected-output <n>", "Expected output tokens", (v) => Number.parseInt(v, 10))
  .option("--all", "Compare across all supported models")
  .action((opts) => {
    estimateCommand({
      file: opts.file,
      text: opts.text,
      model: opts.model as ModelId,
      expectedOutput: opts.expectedOutput,
      all: Boolean(opts.all),
    });
  });

const budget = program.command("budget").description("View or set spending budget");
budget
  .command("show", { isDefault: true })
  .description("Show current budget and last 24h spend")
  .action(() => budgetShow());
budget
  .command("set <daily>")
  .description("Set daily USD cap")
  .action((amount: string) => budgetSet(Number.parseFloat(amount)));

program
  .command("run")
  .description("Run a wrapped agent with hard budget enforcement: portal run -- <cmd> [args...]")
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (_opts, cmd) => {
    const argv = cmd.args ?? [];
    const code = await budgetRun(argv);
    process.exit(code);
  });

program
  .command("mcp")
  .description("Start the Portal MCP server on stdio (attach from Claude Code, Cursor, Cline, etc.)")
  .action(async () => {
    await startMcpServer();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(kleur.red("error: ") + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});

function isHarness(t: string): t is HarnessId {
  return t === "claude-code" || t === "codex" || t === "cursor";
}

function exitBadTarget(t: string): never {
  console.error(kleur.red(`Unknown harness: ${t}. Use one of: claude-code, codex, cursor`));
  process.exit(1);
}
