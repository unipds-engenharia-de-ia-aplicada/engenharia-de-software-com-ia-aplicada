# Canvas de Schema de Ferramenta
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 2.4**

Compare as duas versões abaixo antes de declarar o schema da sua própria ferramenta.

---

## ❌ Schema mal tipado

```json
{
  "name": "buscar_clausula",
  "description": "busca informação",
  "parameters": {
    "tema": "string",
    "jurisdicao": "string"
  }
}
```

**Problemas:** descrição vaga ("busca informação" não diz o domínio, o modelo pode confundir com outra ferramenta parecida); `jurisdicao` como texto livre permite "ANVISA", "Anvisa", "anvisa (Brasil)": três valores diferentes para a mesma coisa, e todos quebram um código downstream que espera um valor exato.

---

## ✅ Schema bem tipado

```json
{
  "name": "buscar_clausula_regulatoria",
  "description": "Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento.",
  "parameters": {
    "tema": { "type": "string", "description": "Tema da cláusula, ex: 'assentimento_menor', 'teste_hiv'" },
    "jurisdicao": { "type": "string", "enum": ["ANVISA", "FDA"] }
  },
  "returns": {
    "texto": "string",
    "fonte": "string, ex: RDC ANVISA 466/2012, Art. 4º"
  }
}
```

**Por que funciona:** descrição específica reduz erro de seleção entre ferramentas parecidas; `jurisdicao` restrita a `enum` elimina variação de grafia; `returns` tipado obriga o retorno a vir sempre no mesmo formato, com a fonte explícita para auditoria.

---

## Retorno quando a busca falha

O schema acima só mostra o caminho de sucesso. Quando a busca não encontra nenhum resultado para o tema pedido, o retorno não deveria ser um erro genérico sem contexto: deveria vir no mesmo formato do sucesso, mas sinalizando explicitamente que não encontrou, com uma sugestão de próximo passo.

```json
{
  "texto": null,
  "fonte": null,
  "aviso": "não encontrado: nenhuma cláusula sobre 'teste_hiv' na jurisdição ANVISA. Tente jurisdicao: 'FDA' ou revise o tema."
}
```

**Por que isso importa:** mesmas chaves do sucesso, com `null` explícito em vez de omitir o campo, mais uma sugestão de próximo passo. É esse formato consistente que permite ao próximo Pensamento do loop interpretar "não encontrado" sem ambiguidade, em vez de confundir com "a cláusula não existe".

---

## Exemplo de ferramenta de escrita: notificar_evento_adverso_regulatorio

Os dois schemas acima são de leitura: buscam informação, não alteram nada no mundo real. Uma ferramenta de escrita, que altera estado real, precisa de um campo a mais.

```json
{
  "name": "notificar_evento_adverso_regulatorio",
  "description": "Notifica um evento adverso grave à autoridade regulatória (ANVISA ou FDA), dentro do prazo exigido. Use só depois que o evento já foi classificado e confirmado como notificação obrigatória.",
  "parameters": {
    "estudo_id": { "type": "string", "description": "Identificador do estudo clínico" },
    "categoria_evento": { "type": "string", "description": "Categoria do evento, conforme dicionário de codificação, ex: 'reacao_alergica_grave'" },
    "jurisdicao": { "type": "string", "enum": ["ANVISA", "FDA"] }
  },
  "requer_aprovacao": true,
  "returns": {
    "notificacao_id": "string",
    "status": "string",
    "prazo_cumprido": "boolean"
  }
}
```

**A diferença que importa:** `requer_aprovacao: true` por padrão força a chamada a passar por uma etapa de confirmação humana antes da execução de fato, o Approval Gate do Módulo 1.3. A diferença entre essa ferramenta e a busca de cláusula regulatória não está na complexidade técnica — está em ser, ao mesmo tempo, uma escrita real E um erro caro e irreversível (Pergunta 2 do Módulo 1.3): notificar a autoridade errado, ou não notificar quando deveria, não tem como desfazer depois de enviado. É essa combinação, não só "é escrita", que exige o gate síncrono.

---

## Checklist antes de declarar uma ferramenta nova

- [ ] A descrição menciona o domínio específico, não uma frase genérica?
- [ ] Todo parâmetro com um conjunto fixo de valores possíveis usa `enum`, não texto livre?
- [ ] O formato de retorno está declarado, não deixado livre para o modelo interpretar?
- [ ] Se a ferramenta escreve/altera algo real (não só lê), ela está marcada para passar pelo Approval Gate antes de executar?
- [ ] Nem toda ferramenta de escrita precisa travar a execução esperando aprovação: revise a Pergunta 2 do Módulo 1.3 (o erro é caro E irreversível?). Se for caro mas reversível, `requer_aprovacao` pode significar revisão assíncrona depois, não bloqueio síncrono antes.

---

## Seu caso: declare o schema da sua própria ferramenta

Escolha uma ferramenta que um agente do seu próprio contexto precisaria chamar, seja de leitura ou de escrita, e declare o schema completo usando os exemplos acima como referência.

```json
{
  "name": "",
  "description": "",
  "parameters": {

  },
  "returns": {

  }
}
```

Se a ferramenta for de escrita, não esqueça o campo `requer_aprovacao`. Depois de preencher, rode o checklist acima linha por linha contra o seu próprio schema antes de considerá-lo pronto.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
