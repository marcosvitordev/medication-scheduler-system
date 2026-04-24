# 🧠 Sistema AT - Backend (Aprazamento de Medicamentos)

Backend completo desenvolvido com **NestJS + TypeScript + PostgreSQL + TypeORM** para o sistema de aprazamento de medicamentos.

---

## 🚀 Tecnologias utilizadas

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- Class-validator

---

## 📦 Funcionalidades

- Cadastro de pacientes
- Cadastro de rotina (acordar, café, almoço, etc.)
- Cadastro de medicamentos
- Classificação por grupos farmacológicos
- Geração automática de horários (aprazamento)
- Aplicação de regras especiais:
  - Cálcio
  - Sais
  - Sucralfato
  - Insulinas
- Tratamento de conflitos entre medicamentos
- Ajuste manual de horários
- Persistência da agenda no banco

---

## 🧩 Grupos de medicamentos

O sistema trabalha com múltiplos grupos:

- Grupo I
- Grupo II
- Grupo II - BIFOS
- Grupo II - SUCRA
- Grupo III (e variações: MET, SUL, SUL2, PROC, etc.)
- Grupo DELTA (não orais)
- Grupo INSULINA (ultra-rápida, rápida, intermediária, longa)

Cada grupo possui regras específicas para cálculo de horários.

---

## ⚙️ Regras especiais implementadas

### 🧪 Cálcio

- Horário base: café + 3 horas
- Se houver conflito com medicamento incompatível → desloca +1h

### 🧪 Sais

- Se houver conflito com medicamento incompatível → dose inativada

### 🧪 Sucralfato

1. Tenta horário principal
2. Se conflito → tenta almoço + 2h
3. Se ainda houver conflito → dose inativada

### 💉 Insulina

- Ultra-rápida: -10 min antes da refeição
- Rápida: -30 min antes da refeição

---

## 🏗️ Estrutura do projeto

```
src/
 ├── modules/
 │   ├── patients/
 │   ├── medications/
 │   ├── prescriptions/
 │   ├── scheduling/
 │
 ├── common/
 │   ├── enums/
 │   ├── utils/
 │
 ├── database/
```

---

## 🧪 Como rodar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/seu-repo.git
cd at-backend
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar banco de dados

Crie um banco PostgreSQL e configure o arquivo `.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=at_system
CALENDAR_COMPANY_NAME=AT Farma
CALENDAR_COMPANY_CNPJ=12.345.678/0001-90
CALENDAR_COMPANY_PHONE=(68)3333-4444
CALENDAR_COMPANY_EMAIL=contato@atfarma.com.br
CALENDAR_PHARMACIST_NAME=Farmacêutica Responsável
CALENDAR_PHARMACIST_CRF=CRF-AC 1234
```

---

### 4. Rodar o projeto

```bash
npm run start:dev
```

---

## 🔌 Endpoints principais

### Criar paciente

```
POST /patients
```

### Criar rotina

```
POST /patients/:id/routines
```

### Catálogo clínico

```
POST   /clinical-catalog/seed         # Popular catálogo com dados iniciais
GET    /clinical-catalog/groups       # Listar grupos clínicos
POST   /clinical-catalog/medications  # Criar medicamento no catálogo
GET    /clinical-catalog/medications  # Listar medicamentos do catálogo
```

### Prescrições do paciente

```
POST   /patient-prescriptions                                           # Criar prescrição
GET    /patient-prescriptions                                           # Listar prescrições
GET    /patient-prescriptions/:id                                       # Buscar prescrição por ID
PATCH  /patient-prescriptions/:id                                       # Atualizar prescrição
POST   /patient-prescriptions/:id/medications/:prescriptionMedicationId/phases  # Adicionar fases a um medicamento da prescrição
```

### Gerar agenda

```
GET /patient-prescriptions/:id/schedule
```

---

## 🧪 Testes recomendados

- Validação de rotina inválida
- Grupo II (jejum)
- Grupo III (refeição)
- Cálcio com conflito
- Sais com conflito
- Sucralfato com deslocamento/inativação
- Insulina com offsets
- Ajuste manual

---

## 📌 Regra principal do sistema

```
horário final = horário base da rotina + offset da fórmula
```

---

## 📄 Observações

- O sistema segue regras farmacológicas baseadas no documento do Sistema AT
- Todas as decisões de horário são automatizadas
- O sistema permite expansão de regras e novos grupos

---

## 👨‍💻 Autores

Desenvolvido por Marcos Vitor & Marcos Vinícius 🚀
