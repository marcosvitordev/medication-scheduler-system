# Matriz de aderência funcional ao cliente

| Cenário | Medicamento / protocolo | Entrada principal | Expectativa no calendário |
| --- | --- | --- | --- |
| Rotina válida | Rotina padrão do cliente | Acordar 06:00, café 07:00, almoço 13:00, lanche 16:00, jantar 19:00, dormir 21:00, banho 08:30 | Bloco `routine` preserva todos os horários |
| Grupo I frequência 4 | DORALGINA / GROUP_I_DORALGINA_6H | `frequency=4`, `treatmentDays=6` | Doses 06:00, 12:00, 18:00, 24:00; janela de 6 dias |
| PRN 6/6h | DORALGINA / GROUP_I_DORALGINA_6H | `recurrenceType=PRN`, `prnReason=PAIN`, `treatmentDays=6` | `recorrenciaTexto='Em caso de dor'` e término no 6º dia |
| Bifosfonato semanal | ALENDRONATO / GROUP_II_BIFOS_STANDARD | `WEEKLY`, `weeklyDay=SEGUNDA` | Dose 05:00, âncora ACORDAR, offset -60 |
| Grupo III genérico | MEDICAMENTO GRUPO III / GROUP_III_CAFE_STANDARD | `frequency=3` | Café, almoço e jantar |
| Ajuste manual | LOSARTANA / GROUP_I | `manualAdjustmentEnabled=true`, `manualTimes=['08:15','20:45']` | Horários preservados com âncora MANUAL |
| Colírio | XALACOM / DELTA_OCULAR_BEDTIME | Lateralidade ambos os olhos | Via e modo de uso exibem lateralidade ocular |
| Otológico | OTOCIRIAX / DELTA_OTICO_12H | Lateralidade nas duas orelhas | Via e modo de uso exibem lateralidade otológica |
| Mensal especial | PERLUTAN / DELTA_PERLUTAN_MONTHLY | MENSTRUATION_START, 8º dia ordinal | Texto mensal especial com contagem inclusiva |
| Conflito com sais | GASTROGEL + CAPTOPRIL | Dose coincidente em DORMIR | GASTROGEL é inativado por regra obrigatória |
| Conflito com sucralfato | SUCRAFILM + LOSARTANA + ZOLPIDEM | Dose matinal em conflito e dose ao dormir bloqueada | SUCRAFILM desloca para 15:00 e inativa dose ao dormir |
| Conflito com cálcio | CALCIO + bloqueadores 21:00/22:00 | Conflito persistente após deslocamento | Dose conflitante exige ajuste manual |
