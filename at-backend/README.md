# Sistema AT Backend

Documentacao tecnica do backend NestJS responsavel por cadastro clinico, prescricoes e geracao/persistencia de agenda posologica.

## Stack tecnica

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- class-validator

## Modulos principais

- patients: cadastro de paciente e rotina
- clinical-catalog: grupos, medicamentos, protocolos e regras de interacao
- patient-prescriptions: criacao/edicao de prescricoes e fases
- scheduling: motor de horario, resolucao de conflitos e retorno do calendario

## Pre-requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Setup rapido

1. Instalar dependencias

```bash
npm install
```

2. Criar o arquivo .env (exemplo minimo)

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=at_system

DB_SYNC=false
DB_LOGGING=false

CALENDAR_COMPANY_NAME=AT Farma
CALENDAR_COMPANY_CNPJ=12.345.678/0001-90
CALENDAR_COMPANY_PHONE=(68)3333-4444
CALENDAR_COMPANY_EMAIL=contato@atfarma.com.br
CALENDAR_PHARMACIST_NAME=Farmaceutica Responsavel
CALENDAR_PHARMACIST_CRF=CRF-AC 1234
```

3. Rodar migrations

```bash
npm run migration:run
```

4. Popular catalogo clinico padrao

```bash
npm run seed
```

5. Subir API em modo desenvolvimento

```bash
npm run start:dev
```

Base URL local:

```text
http://localhost:3000/api
```

## Variaveis de ambiente

Obrigatorias:

- DB_HOST
- DB_PORT
- DB_USERNAME
- DB_PASSWORD
- DB_NAME (preferencial)
- CALENDAR_COMPANY_NAME
- CALENDAR_COMPANY_CNPJ
- CALENDAR_COMPANY_PHONE
- CALENDAR_COMPANY_EMAIL
- CALENDAR_PHARMACIST_NAME
- CALENDAR_PHARMACIST_CRF

Observacoes importantes:

- DB_DATABASE e aceito como fallback legado se DB_NAME nao estiver definido.
- DB_SYNC deve permanecer false em producao. Se NODE_ENV=production e DB_SYNC=true, a aplicacao aborta com erro.
- Campos de cabecalho de calendario faltando causam falha de inicializacao com mensagem explicita da variavel ausente.

## Comandos uteis

```bash
# Desenvolvimento
npm run start:dev

# Build e execucao de producao
npm run build
npm run start:prod

# Migrations
npm run migration:generate
npm run migration:run

# Seed
npm run seed

# Qualidade
npm run lint
npm run format

# Testes
npm test
npm run test:watch
```

## Fluxo recomendado de uso da API

1. Criar paciente
2. Cadastrar rotina ativa do paciente
3. Popular catalogo (seed) ou cadastrar medicamento/protocolo
4. Criar prescricao com medicamentos e fases
5. Buscar agenda em GET /patient-prescriptions/:id/schedule
6. Ajustar prescricao (PATCH) ou anexar novas fases (POST /phases) quando necessario

## Endpoints oficiais

Todos os endpoints abaixo assumem prefixo global /api.

### Patients

```text
POST /patients
GET  /patients
GET  /patients/:id
POST /patients/:id/routines
```

### Clinical Catalog

```text
POST /clinical-catalog/seed
GET  /clinical-catalog/groups
POST /clinical-catalog/medications
GET  /clinical-catalog/medications
```

### Patient Prescriptions

```text
POST  /patient-prescriptions
GET   /patient-prescriptions
GET   /patient-prescriptions/:id
PATCH /patient-prescriptions/:id
POST  /patient-prescriptions/:id/medications/:prescriptionMedicationId/phases
GET   /patient-prescriptions/:id/schedule
```

## Exemplos completos de API

### 1) Criar paciente

```bash
curl -X POST 'http://localhost:3000/api/patients' \
  -H 'Content-Type: application/json' \
  -d '{
    "fullName": "Maria Silva",
    "birthDate": "1980-04-15",
    "rg": "1234567",
    "cpf": "11122233344",
    "phone": "(68)99999-0000"
  }'
```

Resposta esperada (resumo):

```json
{
  "id": "8f6a6958-68a0-4cdd-9bc8-5f87d1dfe2bf",
  "fullName": "Maria Silva",
  "birthDate": "1980-04-15",
  "routines": []
}
```

### 2) Criar rotina do paciente

```bash
curl -X POST 'http://localhost:3000/api/patients/8f6a6958-68a0-4cdd-9bc8-5f87d1dfe2bf/routines' \
  -H 'Content-Type: application/json' \
  -d '{
    "acordar": "06:00",
    "cafe": "07:00",
    "almoco": "12:00",
    "lanche": "15:00",
    "jantar": "19:00",
    "dormir": "22:00",
    "banho": "08:30"
  }'
```

### 3) Popular catalogo clinico padrao via API

```bash
curl -X POST 'http://localhost:3000/api/clinical-catalog/seed'
```

### 4) Listar medicamentos do catalogo e capturar IDs

```bash
curl 'http://localhost:3000/api/clinical-catalog/medications'
```

Resposta esperada (resumo):

```json
[
  {
    "id": "2e3e6f4d-62a8-4a7f-8b91-443d35eb95e8",
    "commercialName": "ALENDRONATO",
    "protocols": [
      {
        "id": "e88f48f9-4863-4574-9e1a-b4ba2276ed1a",
        "code": "GROUP_II_BIFOS"
      }
    ]
  }
]
```

### 5) Criar prescricao

```bash
curl -X POST 'http://localhost:3000/api/patient-prescriptions' \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "8f6a6958-68a0-4cdd-9bc8-5f87d1dfe2bf",
    "startedAt": "2026-04-17",
    "medications": [
      {
        "clinicalMedicationId": "2e3e6f4d-62a8-4a7f-8b91-443d35eb95e8",
        "protocolId": "e88f48f9-4863-4574-9e1a-b4ba2276ed1a",
        "phases": [
          {
            "phaseOrder": 1,
            "frequency": 1,
            "sameDosePerSchedule": true,
            "doseAmount": "1 COMP",
            "doseValue": "1",
            "doseUnit": "COMP",
            "recurrenceType": "DAILY",
            "treatmentDays": 10,
            "continuousUse": false,
            "manualAdjustmentEnabled": false
          }
        ]
      }
    ]
  }'
```

### 6) Atualizar prescricao

```bash
curl -X PATCH 'http://localhost:3000/api/patient-prescriptions/0e0f81d1-5b93-4bcf-b8e1-b30439e7ef6a' \
  -H 'Content-Type: application/json' \
  -d '{
    "startedAt": "2026-04-18"
  }'
```

### 7) Adicionar fases a um medicamento ja presente na prescricao

```bash
curl -X POST 'http://localhost:3000/api/patient-prescriptions/0e0f81d1-5b93-4bcf-b8e1-b30439e7ef6a/medications/cc4f6578-78c7-4f2d-8f79-1946a8bfd7a2/phases' \
  -H 'Content-Type: application/json' \
  -d '{
    "phases": [
      {
        "frequency": 2,
        "sameDosePerSchedule": true,
        "doseAmount": "1 COMP",
        "doseValue": "1",
        "doseUnit": "COMP",
        "recurrenceType": "DAILY",
        "treatmentDays": 7,
        "continuousUse": false,
        "manualAdjustmentEnabled": false
      }
    ]
  }'
```

### 8) Buscar agenda final da prescricao

```bash
curl 'http://localhost:3000/api/patient-prescriptions/0e0f81d1-5b93-4bcf-b8e1-b30439e7ef6a/schedule'
```

Resposta esperada (resumo):

```json
{
  "prescriptionId": "0e0f81d1-5b93-4bcf-b8e1-b30439e7ef6a",
  "documentHeader": {
    "nomeEmpresa": "AT Farma",
    "cnpj": "12.345.678/0001-90"
  },
  "patient": {
    "id": "8f6a6958-68a0-4cdd-9bc8-5f87d1dfe2bf",
    "nome": "Maria Silva"
  },
  "routine": {
    "acordar": "06:00",
    "cafe": "07:00",
    "almoco": "12:00",
    "lanche": "15:00",
    "jantar": "19:00",
    "dormir": "22:00",
    "banho": "08:30"
  },
  "scheduleItems": [
    {
      "prescriptionMedicationId": "cc4f6578-78c7-4f2d-8f79-1946a8bfd7a2",
      "phaseId": "7e6f7cb2-6f4a-4c07-83d7-8f52c7d466f1",
      "phaseOrder": 1,
      "medicamento": "ALENDRONATO",
      "status": "Ativo",
      "doses": [
        {
          "label": "D1",
          "horario": "05:00",
          "status": "ACTIVE",
          "reasonCode": null,
          "conflito": null
        }
      ]
    }
  ]
}
```

Contrato vigente para frontend/demo:

- `POST /patient-prescriptions`, `PATCH /patient-prescriptions/:id` e `GET /patient-prescriptions/:id/schedule` retornam o mesmo formato de calendario (`CalendarScheduleResponseDto`).
- `prescriptionId` e o identificador usado em `PATCH /patient-prescriptions/:id`.
- `scheduleItems[].prescriptionMedicationId` identifica o medicamento dentro da prescricao do paciente.
- `scheduleItems[].phaseId` identifica a fase terapeutica dentro desse medicamento.
- Para ajuste manual de uma fase, o frontend deve enviar `prescriptionId`, `prescriptionMedicationId` e `phaseId` retornados por este calendario.
- O formato atual mistura chaves estruturais em camelCase com campos de exibicao em portugues; essa forma e o contrato oficial desta versao.

## Regras clinicas e resolucao de conflitos (backend)

Regra base de agendamento:

```text
horario resolvido = horario ancora da rotina + offset do protocolo
```

Comportamentos especificos implementados no motor:

- Calcio (GROUP_III_CALC)
  - Horarios base tipicos: cafe + 3h e dormir
  - Em conflito clinico: desloca para frente na janela da regra
  - Se conflito persistir apos novo processamento: status MANUAL_ADJUSTMENT_REQUIRED

- Sais (GROUP_III_SAL)
  - Regras obrigatorias podem inativar dose
  - Saida esperada: status INACTIVE com reasonCode INACTIVATED_BY_MANDATORY_RULE

- Sucralfato (GROUP_II_SUCRA)
  - Dose D1 pode deslocar para ALMOCO + 2h
  - Se houver novo conflito clinico obrigatorio, a dose e inativada

- Insulinas
  - Ultra-rapida e rapida sao tratadas como grupos nao deslocaveis no conflito por prioridade

- Colirios
  - Politica de intervalo minimo de 5 minutos entre aplicacoes oftalmicas
  - Se o ajuste automatico ainda falhar em revalidacao, passa para ajuste manual

Estados de dose relevantes no retorno:

- ACTIVE
- INACTIVE
- MANUAL_ADJUSTMENT_REQUIRED

Campos uteis para diagnostico no retorno da agenda:

- doses[].reasonCode
- doses[].reasonText
- doses[].conflito.tipo_resolucao_codigo
- doses[].conflito.tipo_match_codigo

## Testes

Executar toda a suite:

```bash
npm test
```

Executar arquivo especifico com Jest:

```bash
npx jest test/scheduling-routes.spec.ts
npx jest test/scheduling-contract.spec.ts
npx jest test/client-functional-adherence.spec.ts
npx jest test/scheduling-pdf-core-red.spec.ts
```

Suites chave por objetivo:

- Rotas oficiais e endpoints: test/scheduling-routes.spec.ts
- Contrato final do calendario (frontend/PDF): test/scheduling-contract.spec.ts
- Aderencia funcional de cenarios do cliente: test/client-functional-adherence.spec.ts
- Regras clinicas detalhadas (calcio, sucralfato, conflitos): test/scheduling-pdf-core-red.spec.ts
- Resolucao de conflitos de baixo nivel: test/conflict-resolution.service.spec.ts

## Troubleshooting essencial

1. Erro: DB_SYNC nao pode ser habilitado em producao; use migrations.
   - Causa provavel: NODE_ENV=production com DB_SYNC=true.
   - Como resolver: defina DB_SYNC=false e rode migrations.

2. Erro na inicializacao: Configuracao obrigatoria ausente para calendario posologico: CALENDAR_...
   - Causa provavel: variavel obrigatoria do cabecalho nao foi definida no .env.
   - Como resolver: preencher todas as variaveis CALENDAR_*.

3. Erro ao gerar agenda: Rotina ativa do paciente nao encontrada.
   - Causa provavel: paciente sem rotina ativa cadastrada.
   - Como resolver: cadastrar rotina em POST /patients/:id/routines.

4. Erro ao gerar agenda: Paciente com multiplas rotinas ativas. Corrija a consistencia da base.
   - Causa provavel: inconsistencias de dados com mais de uma rotina ativa para o mesmo paciente.
   - Como resolver: manter apenas uma rotina ativa por paciente.

5. Resposta com MANUAL_ADJUSTMENT_REQUIRED
   - Causa provavel: conflito persistente apos tentativa de deslocamento ou ancora de rotina ausente para a dose.
   - Como resolver: ajustar fase para manualAdjustmentEnabled=true e informar manualTimes, ou revisar protocolo/rotina.

6. Erro de validacao 422 ao criar/atualizar prescricao
   - Causa provavel: inconsistencias em fases (ex.: treatmentDays ausente quando obrigatorio, perDoseOverrides incompleto, manualTimes diferente da frequencia).
   - Como resolver: alinhar payload com regras de validacao de fases.

7. Endpoint de agenda nao encontrado em rotas legadas
   - Causa provavel: uso de rota antiga /schedules.
   - Como resolver: usar GET /patient-prescriptions/:id/schedule.

8. Erro de banco ao subir API ou seed
   - Causa provavel: migrations nao aplicadas ou conexao incorreta.
   - Como resolver: conferir DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME e executar npm run migration:run antes do seed.

## Observacoes de manutencao

- O backend aplica ValidationPipe global com whitelist e transform, removendo campos nao mapeados e transformando tipos quando possivel.
- Em ambiente de producao, prefira pipeline de deploy com migrations versionadas.
- Para manter aderencia funcional, alteracoes no motor de conflitos devem ser acompanhadas por atualizacao de testes de contrato e cenarios RED.
