// exemplo para implementação dentro do padrão de reflection
const verdictSchema = z.object({
  approved: z.boolean(),
  feedback: z
    .string()
    .describe("se aprovado: o que corrigir, em específico e acionável"),
});

async function critique(input: string, result: ReasoningResult) {
  return createModel()
    .withStructuredOutput(verdictSchema)
    .invoke([
      ["system", CRITIC_PROMPT], // avalie APENAS contra as observações do trace e do pedido
      [
        "user",
        `Pedido: ${input}\nObservações: ${observationsOf(result.trace)}\nResposta: ${result.answer}`,
      ],
    ]);
}
