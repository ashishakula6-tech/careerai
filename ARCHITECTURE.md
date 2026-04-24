# HR Recruitment Agent Platform - Architecture Document

## Executive Summary

This document defines the complete technical architecture for an AI-powered HR Recruitment Platform that automates candidate sourcing, parsing, matching, and interview scheduling while maintaining strict compliance, auditability, and human oversight at every critical decision point.

**Core Principle**: AI recommends, humans decide. No automated action affects candidates without explicit human approval.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Component Architecture](#4-component-architecture)
5. [User Flows](#5-user-flows)
6. [Data Flows](#6-data-flows)
7. [Database Architecture](#7-database-architecture)
8. [API Architecture](#8-api-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Monitoring & Observability](#11-monitoring--observability)

---

## 1. System Overview

### 1.1 Purpose

The HR Recruitment Agent Platform automates the recruitment lifecycle while maintaining:
- **Human-in-the-loop control** at all decision points
- **Complete auditability** for regulatory compliance
- **Multi-tenant isolation** for enterprise clients
- **AI transparency** with confidence scores and bias monitoring

### 1.2 Key Stakeholders

| Role | Responsibilities | System Access |
|------|------------------|---------------|
| Recruiter | Manage jobs, review candidates, approve actions | Full dashboard access |
| Hiring Manager | Review shortlisted candidates, interview feedback | Limited dashboard access |
| Admin | Tenant configuration, user management, compliance | Admin panel access |
| Candidate | Apply, view status, manage consent | Candidate portal |
| System | Orchestration, AI processing, notifications | Internal services |

### 1.3 Platform Controls (Risk Elimination)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THREE PLATFORM CONTROLS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. POLICY GATE SERVICE                                             │
│     ├── Validates consent before processing                         │
│     ├── Checks required fields and approvals                        │
│     ├── Enforces suppression rules                                  │
│     └── Gates all irreversible actions                              │
│                                                                     │
│  2. VERSIONING + IMMUTABLE STORAGE                                  │
│     ├── Raw resumes stored separately (never modified)              │
│     ├── All profiles versioned with history                         │
│     └── Enables rollback and reproducibility                        │
│                                                                     │
│  3. COMPREHENSIVE AUDIT LOGGING                                     │
│     ├── Every action logged immutably                               │
│     ├── AI recommendation vs human decision tracked                 │
│     └── 6-year retention for EEOC compliance                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Principles

### 2.1 Core Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| Human-in-the-Loop | AI assists, humans decide | Approval gates before notifications, shortlisting, scheduling |
| Defense in Depth | Multiple security layers | RLS + JWT + API Gateway + Encryption |
| Event-Driven | Loose coupling between services | Kafka for async communication |
| Fail-Safe | Failures don't cause harm | Policy Gate blocks actions without approval |
| Audit Everything | Complete traceability | Immutable audit logs for all state changes |
| Data Isolation | Tenant data never mixed | Row-Level Security at database level |

### 2.2 Architectural Rules

```
RULE 1: "Ranking ≠ Decision"
        Model recommends, doesn't decide
        No auto-rejection based on scores alone

RULE 2: "AI can shortlist, humans finalize"
        All shortlists require human approval
        Override capability at every step

RULE 3: "Never notify before human approval"
        Candidate confirmation is gated and reversible
        Message preview required before send

RULE 4: "AI summarizes, humans judge"
        Evaluation assists decision-making
        Does not replace human judgment
```

---

## 3. High-Level Architecture

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXTERNAL LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│    │  Recruiter   │    │   Hiring     │    │  Candidate   │    │   External   │    │
│    │  Dashboard   │    │   Manager    │    │   Portal     │    │    ATS       │    │
│    │   (React)    │    │  Dashboard   │    │   (React)    │    │  (Webhooks)  │    │
│    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    │
│           │                   │                   │                   │            │
└───────────┼───────────────────┼───────────────────┼───────────────────┼────────────┘
            │                   │                   │                   │
            ▼                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   API GATEWAY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│    ┌─────────────────────────────────────────────────────────────────────────┐     │
│    │                         Kong / AWS API Gateway                           │     │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │     │
│    │  │ JWT Auth    │  │ Rate Limit  │  │ CORS        │  │ Request Log │    │     │
│    │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │     │
│    └─────────────────────────────────────────────────────────────────────────┘     │
│                                         │                                           │
└─────────────────────────────────────────┼───────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │                         POLICY GATE SERVICE (FastAPI)                       │    │
│  │                                                                             │    │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │   │ Consent     │  │ Validation  │  │ Approval    │  │ Suppression │      │    │
│  │   │ Check       │  │ Rules       │  │ State       │  │ Rules       │      │    │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  │                                                                             │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                         │                                           │
│                                         ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │                         n8n ORCHESTRATION LAYER                             │    │
│  │                                                                             │    │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │   │ Candidate   │  │ Interview   │  │ Notification│  │ Reporting   │      │    │
│  │   │ Pipeline    │  │ Scheduling  │  │ Flow        │  │ Flow        │      │    │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  │                                                                             │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                         │                                           │
│                                         ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              AI AGENTS LAYER                                 │   │
│  │                                                                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │   │
│  │  │   Resume     │ │  Matching    │ │  Ranking     │ │  Evaluation  │       │   │
│  │  │   Parser     │ │   Agent      │ │   Agent      │ │    Agent     │       │   │
│  │  │              │ │              │ │              │ │              │       │   │
│  │  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │       │   │
│  │  │ │Confidence│ │ │ │ Vector   │ │ │ │ Multi-   │ │ │ │ Scoring  │ │       │   │
│  │  │ │ Scores   │ │ │ │ Matching │ │ │ │ Signal   │ │ │ │ Rubrics  │ │       │   │
│  │  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │       │   │
│  │  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │       │   │
│  │  │ │ Fallback │ │ │ │ Bias     │ │ │ │ No Auto  │ │ │ │ Human    │ │       │   │
│  │  │ │ Parsing  │ │ │ │ Monitor  │ │ │ │ Reject   │ │ │ │ Override │ │       │   │
│  │  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │       │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           SUPPORT SERVICES                                   │   │
│  │                                                                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │   │
│  │  │ Notification │ │  Calendar    │ │   Audit      │ │   Consent    │       │   │
│  │  │   Service    │ │  Service     │ │   Logger     │ │   Manager    │       │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ PostgreSQL   │ │    Redis     │ │   AWS S3     │ │   Pinecone   │              │
│  │   15+ RLS    │ │   Cache      │ │   Storage    │ │   Vectors    │              │
│  │              │ │              │ │              │ │              │              │
│  │ • Tenants    │ │ • Sessions   │ │ • Raw Resume │ │ • Candidate  │              │
│  │ • Users      │ │ • Rate Limit │ │ • Documents  │ │   Embeddings │              │
│  │ • Jobs       │ │ • Profile    │ │ • Exports    │ │ • Job        │              │
│  │ • Candidates │ │   Cache      │ │              │ │   Embeddings │              │
│  │ • Audit Logs │ │              │ │              │ │              │              │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                                     │
│  ┌──────────────┐ ┌──────────────┐                                                 │
│  │    Kafka     │ │Elasticsearch │                                                 │
│  │   Streaming  │ │  Audit Logs  │                                                 │
│  │              │ │              │                                                 │
│  │ • Events     │ │ • Search     │                                                 │
│  │ • Job Queues │ │ • Analytics  │                                                 │
│  │ • Audit      │ │ • 6yr Retain │                                                 │
│  └──────────────┘ └──────────────┘                                                 │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW (ALL REQUESTS)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

  Client Request
       │
       ▼
  ┌─────────────┐
  │ API Gateway │──────► Authentication (JWT)
  └──────┬──────┘        Rate Limiting
         │               CORS Validation
         ▼
  ┌─────────────┐
  │   Policy    │──────► Consent Check
  │    Gate     │        Approval State
  │   Service   │        Suppression Rules
  └──────┬──────┘        Field Validation
         │
         ▼
  ┌─────────────┐
  │   n8n       │──────► Workflow Orchestration
  │Orchestrator │        Error Handling
  └──────┬──────┘        Retry Logic
         │
         ▼
  ┌─────────────┐
  │    AI       │──────► Processing
  │   Agents    │        Confidence Scoring
  └──────┬──────┘        Bias Monitoring
         │
         ▼
  ┌─────────────┐
  │   Audit     │──────► Log Action
  │   Logger    │        Store Immutably
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Database   │──────► RLS Enforcement
  │ (PostgreSQL)│        Data Persistence
  └─────────────┘
```

---

## 4. Component Architecture

### 4.1 Policy Gate Service

The Policy Gate Service is the central control point that validates all business rules before any action proceeds.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           POLICY GATE SERVICE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         VALIDATION MIDDLEWARE                            │   │
│  │                                                                          │   │
│  │   Request ──► JWT Verify ──► Tenant Context ──► RLS Setup ──► Handler   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                       │
│                                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          POLICY ENGINE                                   │   │
│  │                                                                          │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │   │
│  │  │  Job Intake   │  │  Candidate    │  │   Resume      │               │   │
│  │  │  Validator    │  │  Ingestion    │  │   Parsing     │               │   │
│  │  │               │  │  Validator    │  │   Validator   │               │   │
│  │  │ • Title req   │  │ • Email fmt   │  │ • Confidence  │               │   │
│  │  │ • Desc len    │  │ • Dedup check │  │   threshold   │               │   │
│  │  │ • Skills req  │  │ • File valid  │  │ • Schema      │               │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘               │   │
│  │                                                                          │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │   │
│  │  │   Matching    │  │  Notification │  │   Interview   │               │   │
│  │  │   Validator   │  │   Validator   │  │   Scheduler   │               │   │
│  │  │               │  │               │  │   Validator   │               │   │
│  │  │ • Multi-signal│  │ • Approval    │  │ • Calendar    │               │   │
│  │  │ • No auto-rej │  │   required    │  │   available   │               │   │
│  │  │ • Bias check  │  │ • Suppression │  │ • Timezone    │               │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘               │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                       │
│                                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         VALIDATION RESPONSE                              │   │
│  │                                                                          │   │
│  │   {                                                                      │   │
│  │     "is_valid": true/false,                                              │   │
│  │     "errors": ["Error messages..."],                                     │   │
│  │     "warnings": ["Warning messages..."],                                 │   │
│  │     "metadata": {                                                        │   │
│  │       "validation_timestamp": "2024-01-15T10:30:00Z",                   │   │
│  │       "workflow_step": "candidate_matching",                             │   │
│  │       "requires_human_review": true,                                     │   │
│  │       "is_recommendation_only": true                                     │   │
│  │     }                                                                    │   │
│  │   }                                                                      │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Policy Gate Checks by Workflow Step:**

| Workflow Step | Checks Performed | Blocks If |
|---------------|------------------|-----------|
| Job Intake | Required fields, title length, description quality | Missing required fields |
| Candidate Ingestion | Email format, duplicate detection, consent | No consent or duplicate |
| Resume Parsing | Confidence threshold, schema validation | Confidence < 0.6 |
| Matching | Multiple signals present, bias indicators | Auto-reject flag set |
| Notification | Human approval, suppression list | No approval or suppressed |
| Interview Scheduling | Calendar availability, timezone | Conflict or missing timezone |

### 4.2 AI Agents Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI AGENTS LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESUME PARSING AGENT                             │   │
│  │                                                                          │   │
│  │   Raw Resume ──► Text Extraction ──► LLM Parsing ──► Schema Validation  │   │
│  │                                             │                            │   │
│  │                                             ▼                            │   │
│  │                                    Confidence < 0.6?                     │   │
│  │                                      │         │                         │   │
│  │                                   Yes │         │ No                     │   │
│  │                                      ▼         ▼                         │   │
│  │                              Rule-Based    LLM Result                    │   │
│  │                              Fallback      Accepted                      │   │
│  │                                                                          │   │
│  │   Output: {                                                              │   │
│  │     "skills": [...],                                                     │   │
│  │     "experience": [...],                                                 │   │
│  │     "education": [...],                                                  │   │
│  │     "confidence_scores": {                                               │   │
│  │       "skills": 0.85,                                                    │   │
│  │       "experience": 0.72,                                                │   │
│  │       "education": 0.91                                                  │   │
│  │     },                                                                   │   │
│  │     "overall_confidence": 0.82,                                          │   │
│  │     "parsing_method": "llm" | "rule_based" | "hybrid"                    │   │
│  │   }                                                                      │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                       MATCHING & RANKING AGENT                           │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    MULTI-SIGNAL RANKING                          │   │   │
│  │   │                                                                  │   │   │
│  │   │   Signal 1: Skills Match (Vector Similarity)         Weight: 30%│   │   │
│  │   │   Signal 2: Experience Match (Years + Domain)        Weight: 25%│   │   │
│  │   │   Signal 3: Education Match (Degree + Field)         Weight: 15%│   │   │
│  │   │   Signal 4: Location Match (Remote/Onsite)           Weight: 15%│   │   │
│  │   │   Signal 5: Cultural Fit (Values Alignment)          Weight: 15%│   │   │
│  │   │                                                                  │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                         │                                │   │
│  │                                         ▼                                │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                      BIAS MONITORING                             │   │   │
│  │   │                                                                  │   │   │
│  │   │   • Disparate Impact Analysis (4/5ths rule)                     │   │   │
│  │   │   • Protected Class Distribution Check                          │   │   │
│  │   │   • Historical Decision Pattern Analysis                        │   │   │
│  │   │                                                                  │   │   │
│  │   │   Alert if: disparity_ratio < 0.8 or > 1.25                     │   │   │
│  │   │                                                                  │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                         │                                │   │
│  │                                         ▼                                │   │
│  │   Output: {                                                              │   │
│  │     "match_score": 0.78,                                                 │   │
│  │     "ranking_factors": {                                                 │   │
│  │       "skills": 0.85,                                                    │   │
│  │       "experience": 0.72,                                                │   │
│  │       "education": 0.80,                                                 │   │
│  │       "location": 1.0,                                                   │   │
│  │       "cultural_fit": 0.65                                               │   │
│  │     },                                                                   │   │
│  │     "ai_recommendation": "recommend" | "review" | "not_recommend",       │   │
│  │     "bias_score": 0.02,                                                  │   │
│  │     "requires_human_review": true,      ◄── ALWAYS TRUE                  │   │
│  │     "auto_reject": false                ◄── ALWAYS FALSE                 │   │
│  │   }                                                                      │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      INTERVIEW EVALUATION AGENT                          │   │
│  │                                                                          │   │
│  │   Interview Notes ──► Structured Extraction ──► Rubric Scoring          │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    SCORING RUBRICS                               │   │   │
│  │   │                                                                  │   │   │
│  │   │   Technical Skills:    1-5 scale with defined criteria          │   │   │
│  │   │   Problem Solving:     1-5 scale with defined criteria          │   │   │
│  │   │   Communication:       1-5 scale with defined criteria          │   │   │
│  │   │   Cultural Fit:        1-5 scale with defined criteria          │   │   │
│  │   │                                                                  │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │   Output: {                                                              │   │
│  │     "ai_summary": "Candidate demonstrated strong...",                    │   │
│  │     "structured_scores": {...},                                          │   │
│  │     "strengths": [...],                                                  │   │
│  │     "areas_for_improvement": [...],                                      │   │
│  │     "ai_recommendation": "proceed" | "second_interview" | "not_proceed",│   │
│  │     "human_decision_required": true     ◄── ALWAYS TRUE                  │   │
│  │   }                                                                      │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 n8n Orchestration Workflows

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          n8n ORCHESTRATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    CANDIDATE PIPELINE WORKFLOW                           │   │
│  │                                                                          │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐             │   │
│  │   │ Trigger │───►│ Policy  │───►│ Ingest  │───►│ Policy  │             │   │
│  │   │ (Event) │    │ Gate 1  │    │ Resume  │    │ Gate 2  │             │   │
│  │   └─────────┘    └────┬────┘    └─────────┘    └────┬────┘             │   │
│  │                       │                             │                   │   │
│  │                  ┌────▼────┐                   ┌────▼────┐             │   │
│  │                  │  Fail?  │                   │  Fail?  │             │   │
│  │                  │ ──► End │                   │ ──► End │             │   │
│  │                  └─────────┘                   └─────────┘             │   │
│  │                                                     │                   │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌───▼─────┐            │   │
│  │   │ Queue   │◄───│ Policy  │◄───│ Match   │◄───│  Parse  │            │   │
│  │   │Approval │    │ Gate 4  │    │ & Rank  │    │ Resume  │            │   │
│  │   └────┬────┘    └─────────┘    └─────────┘    └─────────┘            │   │
│  │        │                                                               │   │
│  │        │         ┌───────────────────────────────────┐                │   │
│  │        └────────►│      HUMAN APPROVAL CHECKPOINT     │                │   │
│  │                  │                                    │                │   │
│  │                  │  • Dashboard notification          │                │   │
│  │                  │  • Email to recruiter              │                │   │
│  │                  │  • Wait for approval/rejection     │                │   │
│  │                  │  • Timeout after 7 days            │                │   │
│  │                  │                                    │                │   │
│  │                  └──────────────┬────────────────────┘                │   │
│  │                                 │                                      │   │
│  │                      ┌──────────┴──────────┐                          │   │
│  │                      │                     │                          │   │
│  │                 Approved              Rejected                         │   │
│  │                      │                     │                          │   │
│  │                      ▼                     ▼                          │   │
│  │              ┌─────────────┐       ┌─────────────┐                    │   │
│  │              │   Policy    │       │   Policy    │                    │   │
│  │              │   Gate 5    │       │   Gate 5    │                    │   │
│  │              └──────┬──────┘       └──────┬──────┘                    │   │
│  │                     │                     │                           │   │
│  │                     ▼                     ▼                           │   │
│  │              ┌─────────────┐       ┌─────────────┐                    │   │
│  │              │   Send      │       │   Send      │                    │   │
│  │              │  Shortlist  │       │  Rejection  │                    │   │
│  │              │Notification │       │Notification │                    │   │
│  │              └─────────────┘       └─────────────┘                    │   │
│  │                                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                 INTERVIEW SCHEDULING WORKFLOW                            │   │
│  │                                                                          │   │
│  │   Shortlist        Check           Check           Create               │   │
│  │   Approved ───► Policy Gate ───► Calendar ───► Policy Gate ───► Event  │   │
│  │                                  Available?                              │   │
│  │                                      │                                   │   │
│  │                                      ▼                                   │   │
│  │                              ┌──────────────┐                            │   │
│  │                              │   Timezone   │                            │   │
│  │                              │Normalization │                            │   │
│  │                              └──────────────┘                            │   │
│  │                                      │                                   │   │
│  │                                      ▼                                   │   │
│  │                              ┌──────────────┐                            │   │
│  │                              │   Send       │                            │   │
│  │                              │  Invitation  │                            │   │
│  │                              │ + Reschedule │                            │   │
│  │                              │    Link      │                            │   │
│  │                              └──────────────┘                            │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. User Flows

### 5.1 Recruiter User Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RECRUITER USER FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────┐                                                                    │
│   │  LOGIN  │                                                                    │
│   └────┬────┘                                                                    │
│        │                                                                         │
│        ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        RECRUITER DASHBOARD                               │   │
│   │                                                                          │   │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │   │
│   │   │  Active Jobs  │  │   Pending     │  │   Recent      │              │   │
│   │   │      (12)     │  │  Approvals(5) │  │  Activity     │              │   │
│   │   └───────────────┘  └───────────────┘  └───────────────┘              │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│        │                      │                       │                          │
│        ▼                      ▼                       ▼                          │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                         FLOW 1: CREATE JOB                                 ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   1. Click "Create Job"                                                    ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   2. Fill Job Form                                                         ║ │
│   ║      ┌────────────────────────────────────────────────────┐               ║ │
│   ║      │ Title*: Senior Software Engineer                   │               ║ │
│   ║      │ Description*: [Rich text editor]                   │               ║ │
│   ║      │ Requirements*:                                     │               ║ │
│   ║      │   - Skills: [Tag input]                            │               ║ │
│   ║      │   - Experience: 5-8 years                          │               ║ │
│   ║      │   - Education: Bachelor's in CS                    │               ║ │
│   ║      │ Location: Remote / San Francisco                   │               ║ │
│   ║      │ Salary Range: $150,000 - $200,000                  │               ║ │
│   ║      └────────────────────────────────────────────────────┘               ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   3. Real-time Validation (Policy Gate)                                    ║ │
│   ║      ┌────────────────────────────────────────────────────┐               ║ │
│   ║      │ ✓ Title meets requirements                         │               ║ │
│   ║      │ ✓ Description is detailed enough                   │               ║ │
│   ║      │ ⚠ Consider adding more specific skills             │               ║ │
│   ║      │ ✓ Salary range is valid                            │               ║ │
│   ║      └────────────────────────────────────────────────────┘               ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   4. Preview & Edit (Before Publishing)                                    ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   5. Publish Job ──────────────────────────────────► Job Active            ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                      FLOW 2: REVIEW CANDIDATES                             ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   1. Select Job from Dashboard                                             ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   2. View Candidate Pipeline                                               ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │  New(45)  │  AI Recommended(12)  │  Shortlisted(8)  │  Interview│   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   3. Review AI Recommendations                                             ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ Candidate: John Smith                                          │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ ┌─────────────────────────────────────────────────────────┐   │   ║ │
│   ║      │ │ AI RECOMMENDATION                          Match: 87%   │   │   ║ │
│   ║      │ │                                                          │   │   ║ │
│   ║      │ │ Skills Match:      ████████░░  82%                      │   │   ║ │
│   ║      │ │ Experience Match:  █████████░  91%                      │   │   ║ │
│   ║      │ │ Education Match:   ████████░░  85%                      │   │   ║ │
│   ║      │ │ Location Match:    ██████████  100%                     │   │   ║ │
│   ║      │ │                                                          │   │   ║ │
│   ║      │ │ Confidence: 0.87   Bias Score: 0.02                     │   │   ║ │
│   ║      │ │                                                          │   │   ║ │
│   ║      │ │ ⓘ This is a RECOMMENDATION only.                        │   │   ║ │
│   ║      │ │   Human decision required.                               │   │   ║ │
│   ║      │ └─────────────────────────────────────────────────────────┘   │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │   [View Resume]  [View Profile]  [View History]                │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   ║ │
│   ║      │   │  SHORTLIST  │  │   REJECT    │  │    HOLD     │           │   ║ │
│   ║      │   │  (Approve)  │  │             │  │             │           │   ║ │
│   ║      │   └─────────────┘  └─────────────┘  └─────────────┘           │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   4. Take Action (Human Decision)                                          ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ Confirm Shortlist for John Smith?                              │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ This will:                                                      │   ║ │
│   ║      │  • Send notification to candidate                               │   ║ │
│   ║      │  • Move to interview scheduling                                 │   ║ │
│   ║      │  • Log decision with your name                                  │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ Override Reason (optional): _______________                     │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │          [Cancel]    [Confirm Shortlist]                        │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                      FLOW 3: APPROVE NOTIFICATIONS                         ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   1. View Pending Approvals Queue                                          ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   2. Preview Message                                                       ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ MESSAGE PREVIEW                                                 │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ To: john.smith@email.com                                        │   ║ │
│   ║      │ Subject: Congratulations! You've been shortlisted              │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ Dear John,                                                      │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ We are pleased to inform you that your application for         │   ║ │
│   ║      │ Senior Software Engineer has been shortlisted...               │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ ┌─────────┐  ┌─────────┐  ┌─────────┐                          │   ║ │
│   ║      │ │  EDIT   │  │ APPROVE │  │ REJECT  │                          │   ║ │
│   ║      │ └─────────┘  └─────────┘  └─────────┘                          │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Candidate User Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CANDIDATE USER FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         CANDIDATE PORTAL                                 │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                           FLOW 1: APPLY                                    ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   1. Browse Job Listings                                                   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   2. View Job Details                                                      ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   3. Click "Apply Now"                                                     ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   4. Consent Form (GDPR/CCPA)                                              ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ DATA PROCESSING CONSENT                                         │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ ☐ I consent to processing my personal data for this            │   ║ │
│   ║      │   job application                                               │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ ☐ I consent to storing my profile for future opportunities     │   ║ │
│   ║      │   (optional)                                                    │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ [View Privacy Policy]  [View Data Retention Policy]            │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │                        [Continue]                               │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   5. Upload Resume                                                         ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │   ┌─────────────────────────────────────────┐                  │   ║ │
│   ║      │   │                                         │                  │   ║ │
│   ║      │   │     Drag & Drop Resume Here            │                  │   ║ │
│   ║      │   │           or Click to Browse           │                  │   ║ │
│   ║      │   │                                         │                  │   ║ │
│   ║      │   │     Supported: PDF, DOCX (Max 5MB)     │                  │   ║ │
│   ║      │   │                                         │                  │   ║ │
│   ║      │   └─────────────────────────────────────────┘                  │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   6. Complete Profile (Auto-parsed + Manual Edit)                          ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ ⓘ We've extracted the following from your resume.              │   ║ │
│   ║      │   Please review and correct if needed.                          │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ Name: John Smith ✓                                              │   ║ │
│   ║      │ Email: john.smith@email.com ✓                                   │   ║ │
│   ║      │ Phone: +1 555-123-4567 ✓                                        │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ Skills: [Python] [JavaScript] [AWS] [+Add]                      │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ Experience: 7 years (Edit)                                      │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │                        [Submit Application]                     │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║        │                                                                   ║ │
│   ║        ▼                                                                   ║ │
│   ║   7. Application Submitted                                                 ║ │
│   ║      ┌────────────────────────────────────────────────────────────────┐   ║ │
│   ║      │ ✓ Application Submitted Successfully                            │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ What happens next:                                              │   ║ │
│   ║      │  1. Your profile is being reviewed                              │   ║ │
│   ║      │  2. A recruiter will evaluate your application                  │   ║ │
│   ║      │  3. You'll receive an update within 5-7 business days          │   ║ │
│   ║      │                                                                 │   ║ │
│   ║      │ [View Application Status]  [Return to Jobs]                     │   ║ │
│   ║      └────────────────────────────────────────────────────────────────┘   ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                      FLOW 2: CHECK STATUS                                  ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   ┌────────────────────────────────────────────────────────────────────┐  ║ │
│   ║   │ MY APPLICATIONS                                                     │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ Senior Software Engineer - TechCorp                          │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ │ Applied: Jan 10, 2024                                        │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ │ Status: ● In Review                                          │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ │ ○ Applied ──● In Review ── ○ Shortlisted ── ○ Interview     │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ │ Last Updated: Jan 12, 2024                                   │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   └────────────────────────────────────────────────────────────────────┘  ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                      FLOW 3: MANAGE DATA (GDPR)                            ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   ┌────────────────────────────────────────────────────────────────────┐  ║ │
│   ║   │ MY DATA & PRIVACY                                                   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ [Download My Data]  Export all data in JSON format          │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ [Update Consent]  Modify data processing preferences        │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ [Request Deletion]  Delete all my data (GDPR Article 17)    │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ │ ⚠ This action is irreversible and will:                      │   │  ║ │
│   ║   │ │   • Withdraw all active applications                         │   │  ║ │
│   ║   │ │   • Delete your profile and resume                           │   │  ║ │
│   ║   │ │   • Complete within 30 days                                   │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   └────────────────────────────────────────────────────────────────────┘  ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Admin User Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ADMIN USER FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                          ADMIN DASHBOARD                                 │   │
│   │                                                                          │   │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │   │
│   │   │  User Mgmt    │  │   Compliance  │  │   Audit Logs  │              │   │
│   │   │               │  │   Dashboard   │  │               │              │   │
│   │   └───────────────┘  └───────────────┘  └───────────────┘              │   │
│   │                                                                          │   │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │   │
│   │   │   Settings    │  │  Integrations │  │   Analytics   │              │   │
│   │   │               │  │               │  │               │              │   │
│   │   └───────────────┘  └───────────────┘  └───────────────┘              │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                         USER MANAGEMENT                                    ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   ┌────────────────────────────────────────────────────────────────────┐  ║ │
│   ║   │ USERS                                               [+ Add User]   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ Name           │ Email              │ Role    │ Status │ Act │   │  ║ │
│   ║   │ ├─────────────────────────────────────────────────────────────┤   │  ║ │
│   ║   │ │ Jane Smith     │ jane@company.com   │ Admin   │ Active │ ⚙  │   │  ║ │
│   ║   │ │ John Recruiter │ john@company.com   │ Recruit │ Active │ ⚙  │   │  ║ │
│   ║   │ │ Mary Manager   │ mary@company.com   │ HM      │ Active │ ⚙  │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ROLE PERMISSIONS:                                                   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ Admin:          Full access, user management, settings              │  ║ │
│   ║   │ Recruiter:      Manage jobs, candidates, approvals                  │  ║ │
│   ║   │ Hiring Manager: View shortlisted, interview feedback                │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   └────────────────────────────────────────────────────────────────────┘  ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                       COMPLIANCE DASHBOARD                                 ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   ┌────────────────────────────────────────────────────────────────────┐  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │   GDPR/CCPA Status                     EEOC Compliance              │  ║ │
│   ║   │   ┌─────────────────────┐             ┌─────────────────────┐      │  ║ │
│   ║   │   │ Pending Deletion: 3 │             │ Bias Score: 0.02    │      │  ║ │
│   ║   │   │ Expiring Consent: 12│             │ Status: ✓ Compliant │      │  ║ │
│   ║   │   │ Data Requests: 2    │             │ Last Audit: Jan 10  │      │  ║ │
│   ║   │   └─────────────────────┘             └─────────────────────┘      │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │   AI Transparency Report                                            │  ║ │
│   ║   │   ┌─────────────────────────────────────────────────────────────┐  │  ║ │
│   ║   │   │ AI Recommendations This Month: 1,247                         │  │  ║ │
│   ║   │   │ Human Overrides: 89 (7.1%)                                   │  │  ║ │
│   ║   │   │ Auto-Rejections: 0 (Policy Enforced)                         │  │  ║ │
│   ║   │   │ Average Confidence Score: 0.82                               │  │  ║ │
│   ║   │   └─────────────────────────────────────────────────────────────┘  │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   └────────────────────────────────────────────────────────────────────┘  ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│   ╔═══════════════════════════════════════════════════════════════════════════╗ │
│   ║                           AUDIT LOGS                                       ║ │
│   ╠═══════════════════════════════════════════════════════════════════════════╣ │
│   ║                                                                            ║ │
│   ║   ┌────────────────────────────────────────────────────────────────────┐  ║ │
│   ║   │ AUDIT TRAIL                                        [Export Report] │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ Filters: [All Actions ▼] [All Users ▼] [Date Range]                │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   │ ┌─────────────────────────────────────────────────────────────┐   │  ║ │
│   ║   │ │ Timestamp        │ User      │ Action         │ Entity     │   │  ║ │
│   ║   │ ├─────────────────────────────────────────────────────────────┤   │  ║ │
│   ║   │ │ Jan 15 10:30:45 │ John R    │ CANDIDATE_     │ John Smith │   │  ║ │
│   ║   │ │                  │           │ SHORTLISTED    │ (ID: 1234) │   │  ║ │
│   ║   │ │                  │           │                 │            │   │  ║ │
│   ║   │ │   Details:                                                   │   │  ║ │
│   ║   │ │   - AI Recommendation: recommend (score: 0.87)              │   │  ║ │
│   ║   │ │   - Human Decision: approved                                 │   │  ║ │
│   ║   │ │   - Override: No                                             │   │  ║ │
│   ║   │ │                                                               │   │  ║ │
│   ║   │ ├─────────────────────────────────────────────────────────────┤   │  ║ │
│   ║   │ │ Jan 15 10:25:12 │ System    │ CANDIDATE_     │ Jane Doe   │   │  ║ │
│   ║   │ │                  │           │ MATCHED        │ (ID: 1235) │   │  ║ │
│   ║   │ │                  │           │                 │            │   │  ║ │
│   ║   │ │   Details:                                                   │   │  ║ │
│   ║   │ │   - Match Score: 0.72                                        │   │  ║ │
│   ║   │ │   - Bias Score: 0.01                                         │   │  ║ │
│   ║   │ │   - Awaiting Human Review                                    │   │  ║ │
│   ║   │ └─────────────────────────────────────────────────────────────┘   │  ║ │
│   ║   │                                                                     │  ║ │
│   ║   └────────────────────────────────────────────────────────────────────┘  ║ │
│   ║                                                                            ║ │
│   ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Flows

### 6.1 Complete Candidate Lifecycle Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CANDIDATE LIFECYCLE DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 1: CANDIDATE INGESTION                                                    ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │  Candidate  │─────────│  API        │─────────│  Policy     │             ║
║   │  Applies    │ Resume  │  Gateway    │ Request │  Gate       │             ║
║   │  (Portal)   │  + Data │  (Kong)     │         │  Service    │             ║
║   └─────────────┘         └─────────────┘         └──────┬──────┘             ║
║                                                          │                     ║
║   Data Captured:                          Validations:   │                     ║
║   • Resume file (PDF/DOCX)               • Consent check │                     ║
║   • Email                                • Email format  │                     ║
║   • Name                                 • File type     │                     ║
║   • Consent flags                        • File size     │                     ║
║                                          • Duplicate     │                     ║
║                                                          ▼                     ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                     VALIDATION RESULT                                    │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐                    ┌──────────────┐                  │ ║
║   │   │   VALID      │                    │   INVALID    │                  │ ║
║   │   │              │                    │              │                  │ ║
║   │   │  Continue    │                    │  Return      │                  │ ║
║   │   │  Processing  │                    │  Error       │                  │ ║
║   │   └──────┬───────┘                    └──────────────┘                  │ ║
║   │          │                                                               │ ║
║   └──────────┼───────────────────────────────────────────────────────────────┘ ║
║              │                                                                  ║
║              ▼                                                                  ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         DATA STORAGE                                     │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │ ║
║   │   │   AWS S3     │    │  PostgreSQL  │    │    Kafka     │             │ ║
║   │   │              │    │              │    │              │             │ ║
║   │   │ Raw Resume   │    │ Candidate    │    │ Event:       │             │ ║
║   │   │ (Versioned)  │    │ Record       │    │ CANDIDATE_   │             │ ║
║   │   │              │    │ (tenant_id)  │    │ CREATED      │             │ ║
║   │   │ Path:        │    │              │    │              │             │ ║
║   │   │ /{tenant}/   │    │ Status:      │    │ Triggers:    │             │ ║
║   │   │ /{candidate}/│    │ 'new'        │    │ - Parsing    │             │ ║
║   │   │ /resume_v1   │    │              │    │ - Audit Log  │             │ ║
║   │   └──────────────┘    └──────────────┘    └──────────────┘             │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 2: RESUME PARSING                                                         ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │   Kafka     │─────────│    n8n      │─────────│   Policy    │             ║
║   │   Event     │ Trigger │  Workflow   │ Validate│   Gate      │             ║
║   │   Consumer  │         │             │         │             │             ║
║   └─────────────┘         └──────┬──────┘         └──────┬──────┘             ║
║                                  │                       │                     ║
║                                  ▼                       ▼                     ║
║                           ┌─────────────┐         ┌─────────────┐             ║
║                           │   Resume    │         │  Valid?     │             ║
║                           │   Parser    │         │             │             ║
║                           │   Agent     │         │  Yes ──► Continue        ║
║                           │             │         │  No  ──► Retry/          ║
║                           │  (LLM +     │         │           Manual          ║
║                           │   Rules)    │         │           Review          ║
║                           └──────┬──────┘         └─────────────┘             ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         PARSING OUTPUT                                   │ ║
║   │                                                                          │ ║
║   │   {                                                                      │ ║
║   │     "candidate_id": "uuid",                                              │ ║
║   │     "parsed_profile": {                                                  │ ║
║   │       "skills": ["Python", "AWS", "ML"],                                │ ║
║   │       "experience": [                                                    │ ║
║   │         {"company": "TechCorp", "years": 3, "role": "Engineer"}         │ ║
║   │       ],                                                                 │ ║
║   │       "education": [                                                     │ ║
║   │         {"degree": "BS", "field": "CS", "university": "MIT"}            │ ║
║   │       ]                                                                  │ ║
║   │     },                                                                   │ ║
║   │     "confidence_scores": {                                               │ ║
║   │       "skills": 0.92,                                                    │ ║
║   │       "experience": 0.78,                                                │ ║
║   │       "education": 0.95,                                                 │ ║
║   │       "overall": 0.85                                                    │ ║
║   │     },                                                                   │ ║
║   │     "parsing_method": "llm",                                             │ ║
║   │     "version": 1                                                         │ ║
║   │   }                                                                      │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         DATA STORAGE                                     │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │ ║
║   │   │  PostgreSQL  │    │   Pinecone   │    │    Kafka     │             │ ║
║   │   │              │    │              │    │              │             │ ║
║   │   │ candidate_   │    │ Candidate    │    │ Event:       │             │ ║
║   │   │ profiles     │    │ Embedding    │    │ CANDIDATE_   │             │ ║
║   │   │ (versioned)  │    │ Vector       │    │ PARSED       │             │ ║
║   │   │              │    │              │    │              │             │ ║
║   │   │ Status:      │    │ Metadata:    │    │ Triggers:    │             │ ║
║   │   │ 'parsed'     │    │ tenant_id,   │    │ - Matching   │             │ ║
║   │   │              │    │ job_ids      │    │ - Audit Log  │             │ ║
║   │   └──────────────┘    └──────────────┘    └──────────────┘             │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 3: MATCHING & RANKING                                                     ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │   Kafka     │─────────│    n8n      │─────────│   Policy    │             ║
║   │   Event     │         │  Workflow   │         │   Gate      │             ║
║   └─────────────┘         └──────┬──────┘         └──────┬──────┘             ║
║                                  │                       │                     ║
║                                  ▼                       │                     ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                      MATCHING ENGINE                                     │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │ ║
║   │   │   Pinecone   │    │   Matching   │    │    Bias      │             │ ║
║   │   │   Vector     │───►│    Agent     │───►│   Monitor    │             │ ║
║   │   │   Search     │    │              │    │              │             │ ║
║   │   │              │    │  Multi-      │    │  Disparate   │             │ ║
║   │   │  Find        │    │  Signal      │    │  Impact      │             │ ║
║   │   │  Similar     │    │  Ranking     │    │  Analysis    │             │ ║
║   │   │  Jobs        │    │              │    │              │             │ ║
║   │   └──────────────┘    └──────────────┘    └──────────────┘             │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                       MATCHING OUTPUT                                    │ ║
║   │                                                                          │ ║
║   │   {                                                                      │ ║
║   │     "candidate_id": "uuid",                                              │ ║
║   │     "job_id": "uuid",                                                    │ ║
║   │     "match_score": 0.82,                                                 │ ║
║   │     "ranking_factors": {                                                 │ ║
║   │       "skills_match": 0.85,                                              │ ║
║   │       "experience_match": 0.78,                                          │ ║
║   │       "education_match": 0.90,                                           │ ║
║   │       "location_match": 1.0,                                             │ ║
║   │       "cultural_fit": 0.72                                               │ ║
║   │     },                                                                   │ ║
║   │     "ai_recommendation": "recommend",                                    │ ║
║   │     "bias_score": 0.02,                                                  │ ║
║   │     "auto_reject": false,         ◄── ALWAYS FALSE                       │ ║
║   │     "requires_human_review": true  ◄── ALWAYS TRUE                       │ ║
║   │   }                                                                      │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         DATA STORAGE                                     │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │ ║
║   │   │  PostgreSQL  │    │    Redis     │    │    Kafka     │             │ ║
║   │   │              │    │              │    │              │             │ ║
║   │   │ applications │    │ Pending      │    │ Event:       │             │ ║
║   │   │ table        │    │ Approval     │    │ CANDIDATE_   │             │ ║
║   │   │              │    │ Cache        │    │ MATCHED      │             │ ║
║   │   │ Status:      │    │              │    │              │             │ ║
║   │   │ 'matched'    │    │ TTL: 7 days  │    │ Triggers:    │             │ ║
║   │   │              │    │              │    │ - Dashboard  │             │ ║
║   │   │              │    │              │    │ - Audit Log  │             │ ║
║   │   └──────────────┘    └──────────────┘    └──────────────┘             │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 4: HUMAN DECISION (CRITICAL CHECKPOINT)                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                    RECRUITER DASHBOARD                                   │ ║
║   │                                                                          │ ║
║   │   ┌──────────────────────────────────────────────────────────────────┐ │ ║
║   │   │ PENDING APPROVALS (5)                                             │ │ ║
║   │   │                                                                   │ │ ║
║   │   │ ┌─────────────────────────────────────────────────────────────┐ │ │ ║
║   │   │ │ John Smith - Senior Engineer                                 │ │ │ ║
║   │   │ │                                                              │ │ │ ║
║   │   │ │ AI Recommendation: RECOMMEND (87%)                          │ │ │ ║
║   │   │ │ Confidence: 0.85 | Bias: 0.02                               │ │ │ ║
║   │   │ │                                                              │ │ │ ║
║   │   │ │ [View Details] [SHORTLIST] [REJECT] [HOLD]                  │ │ │ ║
║   │   │ └─────────────────────────────────────────────────────────────┘ │ │ ║
║   │   └──────────────────────────────────────────────────────────────────┘ │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║                      ┌──────────────────────┐                                  ║
║                      │   HUMAN DECISION     │                                  ║
║                      │                      │                                  ║
║                      │  ┌────────────────┐  │                                  ║
║                      │  │   SHORTLIST    │──┼──► Approval Flow                 ║
║                      │  └────────────────┘  │                                  ║
║                      │  ┌────────────────┐  │                                  ║
║                      │  │    REJECT      │──┼──► Rejection Flow                ║
║                      │  └────────────────┘  │                                  ║
║                      │  ┌────────────────┐  │                                  ║
║                      │  │     HOLD       │──┼──► Review Later                  ║
║                      │  └────────────────┘  │                                  ║
║                      │                      │                                  ║
║                      │  Override Reason:    │                                  ║
║                      │  [_______________]   │                                  ║
║                      │                      │                                  ║
║                      └──────────────────────┘                                  ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         AUDIT LOG                                        │ ║
║   │                                                                          │ ║
║   │   {                                                                      │ ║
║   │     "action": "CANDIDATE_SHORTLISTED",                                   │ ║
║   │     "actor": "recruiter@company.com",                                    │ ║
║   │     "timestamp": "2024-01-15T10:30:45Z",                                 │ ║
║   │     "candidate_id": "uuid",                                              │ ║
║   │     "job_id": "uuid",                                                    │ ║
║   │     "ai_recommendation": {                                               │ ║
║   │       "decision": "recommend",                                           │ ║
║   │       "score": 0.87,                                                     │ ║
║   │       "confidence": 0.85                                                 │ ║
║   │     },                                                                   │ ║
║   │     "human_decision": "shortlist",                                       │ ║
║   │     "override": false,                                                   │ ║
║   │     "override_reason": null                                              │ ║
║   │   }                                                                      │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 5: NOTIFICATION (GATED)                                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │   Human     │─────────│   Policy    │─────────│ Notification│             ║
║   │   Approval  │         │   Gate      │         │  Service    │             ║
║   │   Received  │         │             │         │             │             ║
║   └─────────────┘         └──────┬──────┘         └──────┬──────┘             ║
║                                  │                       │                     ║
║                           Checks:│                       │                     ║
║                           • Approval exists              │                     ║
║                           • Suppression list             │                     ║
║                           • Message approved             │                     ║
║                                  │                       │                     ║
║                                  ▼                       │                     ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                    MESSAGE PREVIEW (REQUIRED)                            │ ║
║   │                                                                          │ ║
║   │   To: john.smith@email.com                                               │ ║
║   │   Subject: Congratulations! You've been shortlisted                      │ ║
║   │                                                                          │ ║
║   │   Dear John,                                                             │ ║
║   │                                                                          │ ║
║   │   We are pleased to inform you that your application for                 │ ║
║   │   Senior Software Engineer has been shortlisted...                       │ ║
║   │                                                                          │ ║
║   │   [EDIT] [APPROVE & SEND] [CANCEL]                                       │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                            Approved                                            ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                         SEND NOTIFICATION                                │ ║
║   │                                                                          │ ║
║   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │ ║
║   │   │    Email     │    │  PostgreSQL  │    │    Kafka     │             │ ║
║   │   │   Service    │    │              │    │              │             │ ║
║   │   │              │    │ Application  │    │ Event:       │             │ ║
║   │   │ Send via     │    │ Status:      │    │ NOTIFICATION │             │ ║
║   │   │ SendGrid/    │    │ 'shortlisted'│    │ _SENT        │             │ ║
║   │   │ SES          │    │              │    │              │             │ ║
║   │   └──────────────┘    └──────────────┘    └──────────────┘             │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 6: INTERVIEW SCHEDULING                                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │  Shortlist  │─────────│   Policy    │─────────│  Calendar   │             ║
║   │  Confirmed  │         │   Gate      │         │  Service    │             ║
║   └─────────────┘         └──────┬──────┘         └──────┬──────┘             ║
║                                  │                       │                     ║
║                           Checks:│                       │                     ║
║                           • Calendar available           │                     ║
║                           • No double booking            │                     ║
║                           • Timezone valid               │                     ║
║                                  │                       │                     ║
║                                  ▼                       ▼                     ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                      SCHEDULING ENGINE                                   │ ║
║   │                                                                          │ ║
║   │   1. Check interviewer availability (Google Calendar / Outlook)          │ ║
║   │   2. Normalize timezone (candidate vs interviewer)                       │ ║
║   │   3. Find available slots                                                │ ║
║   │   4. Create calendar event                                               │ ║
║   │   5. Generate reschedule link                                            │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                    INTERVIEW INVITATION                                  │ ║
║   │                                                                          │ ║
║   │   To: john.smith@email.com                                               │ ║
║   │                                                                          │ ║
║   │   Interview Details:                                                     │ ║
║   │   • Position: Senior Software Engineer                                   │ ║
║   │   • Date: January 20, 2024                                               │ ║
║   │   • Time: 2:00 PM PST (5:00 PM EST)                                      │ ║
║   │   • Format: Video Call (Zoom)                                            │ ║
║   │                                                                          │ ║
║   │   [Add to Calendar] [Reschedule]                                         │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ PHASE 7: INTERVIEW EVALUATION                                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐             ║
║   │  Interview  │─────────│ Evaluation  │─────────│   Policy    │             ║
║   │  Completed  │  Notes  │   Agent     │  Output │   Gate      │             ║
║   └─────────────┘         └──────┬──────┘         └──────┬──────┘             ║
║                                  │                       │                     ║
║                                  ▼                       │                     ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                      EVALUATION OUTPUT                                   │ ║
║   │                                                                          │ ║
║   │   {                                                                      │ ║
║   │     "ai_summary": "Candidate demonstrated strong technical skills...",   │ ║
║   │     "structured_scores": {                                               │ ║
║   │       "technical_skills": 4.2,                                           │ ║
║   │       "problem_solving": 3.8,                                            │ ║
║   │       "communication": 4.5,                                              │ ║
║   │       "cultural_fit": 4.0                                                │ ║
║   │     },                                                                   │ ║
║   │     "strengths": ["System design", "Communication"],                     │ ║
║   │     "areas_for_improvement": ["Depth in distributed systems"],           │ ║
║   │     "ai_recommendation": "proceed",                                      │ ║
║   │     "human_decision_required": true  ◄── ALWAYS TRUE                     │ ║
║   │   }                                                                      │ ║
║   │                                                                          │ ║
║   │   ⓘ This is a SUMMARY to assist decision-making.                        │ ║
║   │     Human judgment is required for final decision.                       │ ║
║   │                                                                          │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
║                                  │                                             ║
║                                  ▼                                             ║
║                      ┌──────────────────────┐                                  ║
║                      │   HIRING MANAGER     │                                  ║
║                      │   DECISION           │                                  ║
║                      │                      │                                  ║
║                      │  [HIRE] [REJECT]     │                                  ║
║                      │  [2ND INTERVIEW]     │                                  ║
║                      │                      │                                  ║
║                      └──────────────────────┘                                  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

### 6.2 Data Flow Summary Table

| Phase | Input | Processing | Output | Storage | Human Gate |
|-------|-------|------------|--------|---------|------------|
| 1. Ingestion | Resume + Profile | Validation, Dedup | Candidate Record | S3, PostgreSQL | Consent Required |
| 2. Parsing | Raw Resume | LLM + Rules | Parsed Profile | PostgreSQL, Pinecone | Manual Review if Low Confidence |
| 3. Matching | Profile + Job | Vector Search, Multi-Signal | Match Score | PostgreSQL, Redis | **Required** |
| 4. Decision | AI Recommendation | Human Review | Shortlist/Reject | PostgreSQL, Audit Log | **Required** |
| 5. Notification | Approved Decision | Template + Preview | Email/SMS | PostgreSQL | **Required** |
| 6. Scheduling | Shortlist Approval | Calendar Check | Interview Event | Calendar, PostgreSQL | None (Automated after approval) |
| 7. Evaluation | Interview Notes | Rubric Scoring | Evaluation Summary | PostgreSQL, Audit Log | **Required** |

---

## 7. Database Architecture

### 7.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIP DIAGRAM                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     TENANTS      │       │      USERS       │       │      JOBS        │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │───┐   │ id (PK)          │   ┌───│ id (PK)          │
│ name             │   │   │ tenant_id (FK)   │◄──┤   │ tenant_id (FK)   │◄──┐
│ domain           │   │   │ email            │   │   │ title            │   │
│ subscription_tier│   │   │ password_hash    │   │   │ description      │   │
│ data_region      │   │   │ full_name        │   │   │ requirements     │   │
│ gdpr_compliant   │   │   │ role             │   │   │ location         │   │
│ ccpa_compliant   │   │   │ permissions      │   │   │ status           │   │
│ created_at       │   │   │ is_active        │   │   │ created_by (FK)  │───┤
│ updated_at       │   │   │ created_at       │   │   │ created_at       │   │
│ deleted_at       │   │   │ updated_at       │   │   │ deleted_at       │   │
└──────────────────┘   │   └──────────────────┘   │   └──────────────────┘   │
                       │                          │                          │
                       │   ┌──────────────────────┘                          │
                       │   │                                                  │
                       │   │   ┌──────────────────┐                          │
                       │   │   │   CANDIDATES     │                          │
                       │   │   ├──────────────────┤                          │
                       │   └──►│ id (PK)          │                          │
                       │       │ tenant_id (FK)   │◄─────────────────────────┘
                       └──────►│ email            │
                               │ phone_hash       │
                               │ first_name       │
                               │ last_name        │
                               │ consent_given    │
                               │ status           │
                               │ source           │
                               │ created_at       │
                               │ deleted_at       │
                               └────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   RAW_RESUMES        │  │CANDIDATE_PROFILES│  │    APPLICATIONS      │
├──────────────────────┤  ├──────────────────┤  ├──────────────────────┤
│ id (PK)              │  │ id (PK)          │  │ id (PK)              │
│ candidate_id (FK)    │  │ candidate_id (FK)│  │ tenant_id (FK)       │
│ tenant_id (FK)       │  │ skills           │  │ candidate_id (FK)    │
│ s3_bucket            │  │ experience       │  │ job_id (FK)          │
│ s3_key               │  │ education        │  │ match_score          │
│ s3_version_id        │  │ confidence_scores│  │ ranking_factors      │
│ file_name            │  │ embedding_id     │  │ ai_recommendation    │
│ file_hash            │  │ is_current       │  │ human_decision       │
│ encryption_algorithm │  │ version          │  │ bias_score           │
│ uploaded_at          │  │ created_at       │  │ status               │
│ deleted_at           │  │ updated_at       │  │ approved_by (FK)     │
└──────────────────────┘  └──────────────────┘  │ created_at           │
                                                │ updated_at           │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
                          ┌──────────────────────────────────────────────────┐
                          │                   AUDIT_LOGS                      │
                          ├──────────────────────────────────────────────────┤
                          │ id (PK)                                          │
                          │ tenant_id (FK)                                   │
                          │ user_id (FK) - nullable for system actions       │
                          │ action                                           │
                          │ entity_type                                      │
                          │ entity_id                                        │
                          │ details (JSONB)                                  │
                          │   - ai_recommendation                            │
                          │   - human_decision                               │
                          │   - override_reason                              │
                          │   - confidence_scores                            │
                          │   - bias_indicators                              │
                          │ ip_address                                       │
                          │ user_agent                                       │
                          │ gdpr_related                                     │
                          │ ccpa_related                                     │
                          │ created_at                                       │
                          │                                                  │
                          │ ⚠ IMMUTABLE - No UPDATE or DELETE allowed       │
                          │ 📅 6-year retention for EEOC compliance          │
                          └──────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│     CONSENTS         │  │   NOTIFICATIONS      │
├──────────────────────┤  ├──────────────────────┤
│ id (PK)              │  │ id (PK)              │
│ candidate_id (FK)    │  │ tenant_id (FK)       │
│ tenant_id (FK)       │  │ candidate_id (FK)    │
│ purpose              │  │ type                 │
│ granted              │  │ status               │
│ granted_at           │  │ message_template     │
│ revoked_at           │  │ message_content      │
│ expires_at           │  │ approved_by (FK)     │
│ created_at           │  │ approved_at          │
└──────────────────────┘  │ sent_at              │
                          │ created_at           │
                          └──────────────────────┘
```

### 7.2 Row-Level Security Implementation

```sql
-- Enable RLS on all tenant-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_jobs ON jobs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_candidates ON candidates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_applications ON applications
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 8. API Architecture

### 8.1 API Endpoints Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API ENDPOINTS                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════════════════════╗
║ AUTHENTICATION                                                                  ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  POST   /auth/register          Register new tenant admin                       ║
║  POST   /auth/login             User login, returns JWT                         ║
║  POST   /auth/refresh           Refresh JWT token                               ║
║  POST   /auth/logout            Invalidate session                              ║
║  GET    /auth/me                Get current user profile                        ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ POLICY GATE (Called by n8n before each workflow step)                           ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  POST   /policy/validate        Validate workflow step                          ║
║                                                                                 ║
║         Request:                                                                ║
║         {                                                                       ║
║           "workflow_step": "candidate_matching",                                ║
║           "data": { ... },                                                      ║
║           "entity_id": "uuid"                                                   ║
║         }                                                                       ║
║                                                                                 ║
║         Response:                                                               ║
║         {                                                                       ║
║           "is_valid": true,                                                     ║
║           "errors": [],                                                         ║
║           "warnings": ["Consider..."],                                          ║
║           "metadata": {                                                         ║
║             "requires_human_review": true,                                      ║
║             "is_recommendation_only": true                                      ║
║           }                                                                     ║
║         }                                                                       ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ JOBS                                                                            ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /jobs                   List jobs (paginated, filtered)                 ║
║  POST   /jobs                   Create new job                                  ║
║  GET    /jobs/{id}              Get job details                                 ║
║  PUT    /jobs/{id}              Update job                                      ║
║  DELETE /jobs/{id}              Soft delete job                                 ║
║  POST   /jobs/{id}/publish      Publish job (after validation)                  ║
║  POST   /jobs/{id}/close        Close job posting                               ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ CANDIDATES                                                                      ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /candidates             List candidates (paginated, filtered)           ║
║  POST   /candidates             Create candidate (with dedup check)             ║
║  GET    /candidates/{id}        Get candidate details                           ║
║  PUT    /candidates/{id}        Update candidate                                ║
║  DELETE /candidates/{id}        GDPR deletion (soft delete + anonymize)         ║
║                                                                                 ║
║  GET    /candidates/{id}/profile        Get parsed profile (latest version)     ║
║  GET    /candidates/{id}/profile/history Get all profile versions              ║
║  GET    /candidates/{id}/resume         Get raw resume (S3 presigned URL)       ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ APPLICATIONS                                                                    ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /applications           List applications (by job or candidate)         ║
║  POST   /applications           Create application                              ║
║  GET    /applications/{id}      Get application with AI scores                  ║
║                                                                                 ║
║  POST   /applications/{id}/shortlist    Shortlist (requires human approval)     ║
║  POST   /applications/{id}/reject       Reject (requires human approval)        ║
║  POST   /applications/{id}/hold         Put on hold                             ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ APPROVALS (Human-in-the-loop)                                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /approvals              List pending approvals                          ║
║  GET    /approvals/{id}         Get approval details                            ║
║  POST   /approvals/{id}/approve Approve action                                  ║
║  POST   /approvals/{id}/reject  Reject action                                   ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ NOTIFICATIONS                                                                   ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /notifications          List notifications                              ║
║  GET    /notifications/{id}     Get notification with preview                   ║
║  POST   /notifications/{id}/approve   Approve and send                          ║
║  PUT    /notifications/{id}     Edit message content                            ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ AUDIT                                                                           ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  GET    /audit/logs             List audit logs (filtered, paginated)           ║
║  GET    /audit/logs/{entity_type}/{entity_id}  Get audit trail for entity       ║
║  GET    /audit/reports/compliance   Generate compliance report                  ║
║  GET    /audit/reports/bias         Generate bias analysis report               ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ CANDIDATE PORTAL (Public, requires candidate auth)                              ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  POST   /portal/apply           Submit application                              ║
║  GET    /portal/applications    View my applications                            ║
║  GET    /portal/profile         View my profile                                 ║
║  PUT    /portal/profile         Update my profile                               ║
║  GET    /portal/data            Export my data (GDPR/CCPA)                      ║
║  DELETE /portal/data            Request data deletion (GDPR/CCPA)               ║
║  PUT    /portal/consent         Update consent preferences                      ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

### 8.2 API Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        API REQUEST/RESPONSE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

  Client Request
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                         │
│                                                                                 │
│   1. Rate Limiting Check                                                        │
│      └─► 429 Too Many Requests if exceeded                                      │
│                                                                                 │
│   2. JWT Token Validation                                                       │
│      └─► 401 Unauthorized if invalid/expired                                    │
│                                                                                 │
│   3. Extract Tenant ID from Token                                               │
│      └─► Set X-Tenant-ID header                                                 │
│                                                                                 │
│   4. Request Logging                                                            │
│      └─► Log request to audit trail                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI APPLICATION                                     │
│                                                                                 │
│   1. Middleware: Set Tenant Context                                             │
│      └─► SET app.current_tenant_id = '{tenant_id}'                              │
│                                                                                 │
│   2. Dependency Injection                                                       │
│      └─► get_current_user()                                                     │
│      └─► get_current_tenant()                                                   │
│      └─► get_db_connection() (with RLS)                                         │
│                                                                                 │
│   3. Request Validation (Pydantic)                                              │
│      └─► 422 Validation Error if invalid                                        │
│                                                                                 │
│   4. Business Logic                                                             │
│      └─► Service Layer                                                          │
│      └─► Repository Layer (RLS enforced)                                        │
│                                                                                 │
│   5. Audit Logging                                                              │
│      └─► Log action with user, tenant, entity                                   │
│                                                                                 │
│   6. Response                                                                   │
│      └─► 200/201 Success                                                        │
│      └─► 400 Bad Request                                                        │
│      └─► 403 Forbidden (RLS violation)                                          │
│      └─► 404 Not Found                                                          │
│      └─► 500 Internal Server Error                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  Client Response
```

---

## 9. Security Architecture

### 9.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════════════════════╗
║ LAYER 1: NETWORK SECURITY                                                       ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐  ║
║   │ • TLS 1.3 for all traffic (in transit encryption)                       │  ║
║   │ • WAF (Web Application Firewall) for DDoS protection                    │  ║
║   │ • VPC with private subnets for internal services                        │  ║
║   │ • Security groups restricting port access                               │  ║
║   │ • API Gateway with rate limiting (100 req/min per tenant)               │  ║
║   └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ LAYER 2: AUTHENTICATION & AUTHORIZATION                                         ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐  ║
║   │ • JWT tokens with RS256 signing (15 min expiry)                         │  ║
║   │ • Refresh tokens (7 day expiry, single use)                             │  ║
║   │ • bcrypt password hashing (cost factor 12)                              │  ║
║   │ • RBAC (Role-Based Access Control)                                      │  ║
║   │   - Admin: Full access                                                  │  ║
║   │   - Recruiter: Jobs, candidates, approvals                              │  ║
║   │   - Hiring Manager: View shortlisted, feedback                          │  ║
║   │ • MFA support (TOTP)                                                    │  ║
║   │ • Session management with Redis                                         │  ║
║   └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ LAYER 3: DATA ISOLATION                                                         ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐  ║
║   │ • Row-Level Security (RLS) in PostgreSQL                                │  ║
║   │   - Every query filtered by tenant_id                                   │  ║
║   │   - Enforced at database level (cannot bypass)                          │  ║
║   │ • Separate S3 prefixes per tenant                                       │  ║
║   │ • Separate vector indexes per tenant in Pinecone                        │  ║
║   │ • Redis key namespacing by tenant                                       │  ║
║   └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ LAYER 4: DATA ENCRYPTION                                                        ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐  ║
║   │ AT REST:                                                                │  ║
║   │ • PostgreSQL: pgcrypto extension for PII fields                         │  ║
║   │ • S3: SSE-S3 encryption (AES-256)                                       │  ║
║   │ • Redis: Encrypted volumes                                              │  ║
║   │                                                                          │  ║
║   │ IN TRANSIT:                                                             │  ║
║   │ • TLS 1.3 for all external traffic                                      │  ║
║   │ • mTLS between internal services (Istio)                                │  ║
║   │                                                                          │  ║
║   │ KEY MANAGEMENT:                                                         │  ║
║   │ • HashiCorp Vault for secrets                                           │  ║
║   │ • Automatic key rotation (90 days)                                      │  ║
║   └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ LAYER 5: AUDIT & COMPLIANCE                                                     ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────────────────────────────────────────────────────────┐  ║
║   │ • Immutable audit logs (no UPDATE/DELETE)                               │  ║
║   │ • 6-year retention (EEOC compliance)                                    │  ║
║   │ • GDPR Article 17 (Right to Erasure) implementation                     │  ║
║   │ • CCPA opt-out mechanisms                                               │  ║
║   │ • Bias monitoring and reporting                                         │  ║
║   │ • AI decision transparency (confidence scores logged)                   │  ║
║   └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

### 9.2 RBAC Permission Matrix

| Permission | Admin | Recruiter | Hiring Manager | Candidate |
|------------|-------|-----------|----------------|-----------|
| Create/Edit Jobs | ✓ | ✓ | ✗ | ✗ |
| View All Candidates | ✓ | ✓ | ✗ | ✗ |
| View Shortlisted | ✓ | ✓ | ✓ | ✗ |
| Shortlist/Reject | ✓ | ✓ | ✗ | ✗ |
| Approve Notifications | ✓ | ✓ | ✗ | ✗ |
| View Audit Logs | ✓ | Limited | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ | ✗ |
| Manage Settings | ✓ | ✗ | ✗ | ✗ |
| Interview Feedback | ✓ | ✓ | ✓ | ✗ |
| View Own Data | ✓ | ✓ | ✓ | ✓ |
| Delete Own Data | ✗ | ✗ | ✗ | ✓ |

---

## 10. Deployment Architecture

### 10.1 Kubernetes Deployment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KUBERNETES DEPLOYMENT                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              KUBERNETES CLUSTER                                  │
│                           (EKS/GKE - Multi-AZ)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           INGRESS LAYER                                  │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    NGINX Ingress Controller                      │   │   │
│  │   │                    + Cert Manager (Let's Encrypt)                │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                     │   │
│  │                                    ▼                                     │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                      Kong API Gateway                            │   │   │
│  │   │                  (JWT, Rate Limiting, CORS)                      │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          APPLICATION LAYER                               │   │
│  │                                                                          │   │
│  │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │   │
│  │   │  Policy Gate      │  │   n8n             │  │   AI Agents       │  │   │
│  │   │  Service          │  │   Orchestrator    │  │   (GPU Nodes)     │  │   │
│  │   │                   │  │                   │  │                   │  │   │
│  │   │  Replicas: 3      │  │  Replicas: 3      │  │  Replicas: 2      │  │   │
│  │   │  CPU: 2 vCPU      │  │  CPU: 4 vCPU      │  │  GPU: T4          │  │   │
│  │   │  Memory: 4GB      │  │  Memory: 8GB      │  │  Memory: 16GB     │  │   │
│  │   │                   │  │                   │  │                   │  │   │
│  │   │  HPA: 70% CPU     │  │  HPA: 70% CPU     │  │  HPA: Queue Depth │  │   │
│  │   └───────────────────┘  └───────────────────┘  └───────────────────┘  │   │
│  │                                                                          │   │
│  │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │   │
│  │   │  Notification     │  │   Calendar        │  │   Audit           │  │   │
│  │   │  Service          │  │   Service         │  │   Service         │  │   │
│  │   │                   │  │                   │  │                   │  │   │
│  │   │  Replicas: 2      │  │  Replicas: 2      │  │  Replicas: 2      │  │   │
│  │   └───────────────────┘  └───────────────────┘  └───────────────────┘  │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            DATA LAYER                                    │   │
│  │                                                                          │   │
│  │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │   │
│  │   │  PostgreSQL       │  │   Redis           │  │   Kafka           │  │   │
│  │   │  (StatefulSet)    │  │   (StatefulSet)   │  │   (StatefulSet)   │  │   │
│  │   │                   │  │                   │  │                   │  │   │
│  │   │  Primary: 1       │  │  Replicas: 3      │  │  Brokers: 3       │  │   │
│  │   │  Replicas: 2      │  │  (Sentinel)       │  │  Zookeeper: 3     │  │   │
│  │   │                   │  │                   │  │                   │  │   │
│  │   │  PVC: 500GB       │  │  PVC: 50GB        │  │  PVC: 200GB       │  │   │
│  │   └───────────────────┘  └───────────────────┘  └───────────────────┘  │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         OBSERVABILITY                                    │   │
│  │                                                                          │   │
│  │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │   │
│  │   │  Prometheus       │  │   Grafana         │  │   Jaeger          │  │   │
│  │   │  (Metrics)        │  │   (Dashboards)    │  │   (Tracing)       │  │   │
│  │   └───────────────────┘  └───────────────────┘  └───────────────────┘  │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐         │
│   │   AWS S3          │  │   Pinecone        │  │   Elasticsearch   │         │
│   │   (Resume Storage)│  │   (Vectors)       │  │   (Audit Logs)    │         │
│   └───────────────────┘  └───────────────────┘  └───────────────────┘         │
│                                                                                 │
│   ┌───────────────────┐  ┌───────────────────┐                                 │
│   │   HashiCorp Vault │  │   SendGrid/SES    │                                 │
│   │   (Secrets)       │  │   (Email)         │                                 │
│   └───────────────────┘  └───────────────────┘                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD PIPELINE                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Code    │───►│  Build   │───►│  Test    │───►│  Deploy  │───►│ Monitor  │
│  Commit  │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ GitHub   │    │ Docker   │    │ pytest   │    │ ArgoCD   │    │Prometheus│
│ Actions  │    │ Build    │    │ Unit     │    │ GitOps   │    │ Grafana  │
│          │    │          │    │ Integr.  │    │          │    │          │
│          │    │ Trivy    │    │ E2E      │    │ Canary   │    │ Alerts   │
│          │    │ Scan     │    │ Bias     │    │ 5%→100%  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘

STAGES:
1. CODE COMMIT
   - PR opened on GitHub
   - Automated linting (ruff, black)
   - Type checking (mypy)

2. BUILD
   - Docker image build
   - Trivy security scan
   - Push to ECR/GCR

3. TEST
   - Unit tests (pytest, >90% coverage)
   - Integration tests (Testcontainers)
   - E2E workflow tests
   - Bias testing (Aequitas)
   - Contract testing (OpenAPI validation)

4. DEPLOY
   - ArgoCD syncs Kubernetes manifests
   - Canary deployment (5% traffic)
   - Health checks pass
   - Gradual rollout (25% → 50% → 100%)
   - Automatic rollback on failure

5. MONITOR
   - Custom metrics (bias_score, processing_time)
   - Alerts for anomalies
   - Audit log verification
```

---

## 11. Monitoring & Observability

### 11.1 Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         GRAFANA DASHBOARDS                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════════════════════╗
║ SYSTEM HEALTH DASHBOARD                                                         ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ API Latency (P99)   │  │ Error Rate          │  │ Request Volume      │   ║
║   │                     │  │                     │  │                     │   ║
║   │    ▃▅▇█▆▄▃▂        │  │    0.02%            │  │    1,247/min        │   ║
║   │    < 200ms ✓        │  │    < 1% ✓           │  │                     │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ Database Connections│  │ Kafka Lag           │  │ Memory Usage        │   ║
║   │                     │  │                     │  │                     │   ║
║   │    45/200           │  │    Consumer: 0      │  │    ████░░ 68%      │   ║
║   │    22.5% ✓          │  │    No lag ✓         │  │    < 80% ✓          │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ BUSINESS METRICS DASHBOARD                                                      ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ Candidates Today    │  │ AI Recommendations  │  │ Human Approvals     │   ║
║   │                     │  │                     │  │                     │   ║
║   │    +127             │  │    1,045            │  │    89 (8.5%)        │   ║
║   │    ↑12% vs yesterday│  │    This week        │  │    Overrides        │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ Avg Match Score     │  │ Avg Confidence      │  │ Processing Time     │   ║
║   │                     │  │                     │  │                     │   ║
║   │    0.78             │  │    0.84             │  │    2.3s avg         │   ║
║   │    ████████░░       │  │    ████████░░       │  │    Per candidate    │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════════╗
║ COMPLIANCE DASHBOARD                                                            ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ Bias Score (Avg)    │  │ Auto-Rejections     │  │ Pending Deletions   │   ║
║   │                     │  │                     │  │                     │   ║
║   │    0.02             │  │    0                │  │    3                │   ║
║   │    < 0.1 ✓          │  │    ALWAYS 0 ✓       │  │    GDPR compliance  │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
║   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║   │ Disparate Impact    │  │ Audit Log Coverage  │  │ Data Retention      │   ║
║   │                     │  │                     │  │                     │   ║
║   │    0.92             │  │    100%             │  │    6 years          │   ║
║   │    0.8-1.25 ✓       │  │    All actions ✓    │  │    EEOC compliant ✓ │   ║
║   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

### 11.2 Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | >1% for 5 min | Critical | Page on-call |
| High Latency | P99 >2s for 5 min | Warning | Slack notification |
| Kafka Lag | >1000 messages | Warning | Scale consumers |
| Database Connections | >80% pool | Warning | Review queries |
| Bias Score High | >0.1 avg | Critical | Compliance review |
| Auto-Rejection Detected | Any occurrence | Critical | Immediate investigation |
| GDPR Deletion Overdue | >30 days pending | Critical | Legal notification |
| Low Confidence Parsing | >20% below threshold | Warning | Model review |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| RLS | Row-Level Security - PostgreSQL feature for data isolation |
| Policy Gate | Central service that validates all business rules before workflow steps |
| Human-in-the-Loop | Design pattern ensuring humans approve critical decisions |
| Confidence Score | AI-generated measure of parsing/matching accuracy (0-1) |
| Bias Score | Measure of potential discrimination in AI recommendations |
| Disparate Impact | Legal standard for measuring discrimination (4/5ths rule) |
| Multi-Tenancy | Architecture supporting multiple isolated clients |
| Immutable Audit Log | Logs that cannot be modified or deleted |

## Appendix B: Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | Architecture Team | Initial document |

---

*This architecture document should be reviewed and updated as the system evolves.*
