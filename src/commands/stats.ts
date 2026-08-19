import kleur from "kleur";
import { getStatsSummary } from "../db.js";
import { formatUsd, usdSavedForTokens } from "../cost.js";

export function statsCommand(): void {
  const { sessionsCompressed, rawTokens, compressedTokens, tokensSaved } = getStatsSummary();

  if (sessionsCompressed === 0) {
    console.log(kleur.dim("No compressed sessions yet — run `contexo handoff` to start saving."));
    return;
  }

  const usdSaved = usdSavedForTokens(tokensSaved);
  const savedPct = rawTokens > 0 ? ((tokensSaved / rawTokens) * 100).toFixed(1) : "0.0";

  console.log(kleur.bold("Contexo savings (local, this machine)"));
  console.log(`  ${kleur.dim("sessions compressed")}  ${sessionsCompressed}`);
  console.log(`  ${kleur.dim("raw tokens")}            ${rawTokens.toLocaleString()}`);
  console.log(`  ${kleur.dim("handoff tokens")}        ${compressedTokens.toLocaleString()}`);
  console.log(
    `  ${kleur.dim("tokens saved")}          ${tokensSaved.toLocaleString()} ` +
      kleur.green(`(-${savedPct}%)`),
  );
  console.log(`  ${kleur.dim("~ saved")}               ${kleur.bold(formatUsd(usdSaved))}`);
  console.log(
    kleur.dim(
      "\n~ approximate — priced at claude-sonnet-4-5 input rate against tokens avoided by not replaying full history.",
    ),
  );
}
