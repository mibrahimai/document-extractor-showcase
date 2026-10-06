# 📄 Document Extractor - Frontend Showcase

[![Live Demo](https://img.shields.io/badge/Try_Live_Demo_Here-Vercel-black?style=for-the-badge&logo=vercel)](#)

Welcome to the **Document Extractor** frontend showcase repository! 

This repository houses the modern, responsive **Next.js/React** user interface for a powerful AI document extraction product. It is designed to beautifully display complex document data, provide a seamless UX for uploading files, and interact efficiently with a custom backend.

> 🔒 **Architecture Note (Portfolio Strategy):** 
> To protect the core intellectual property, this repository acts as a **"Hollow" Showcase** (Frontend only). The heavy lifting—FastAPI, Python extraction logic, prompt engineering, and database integrations—is maintained securely in a private repository deployed to a dedicated VPS.

## 🚀 Features
- **Next.js 15 App Router** for lightning-fast server-side rendering and routing.
- **Beautiful & Modern UI** built for reading structured extractions at a glance.
- **Robust API Client** designed to securely handle requests to the private core backend.

## 🏗️ System Architecture

```mermaid
flowchart LR
    User([👨‍💻 User]) --> |Uploads PDF| FE[🖥️ Next.js Frontend\n(Showcase Repo)]
    FE --> |HTTPS (REST)| BE[🔒 FastAPI Backend\n(Private Repo)]
    
    subgraph Secure VPS
        BE --> |Prompt & Context| AI[🧠 AI/Ollama LLM]
        AI --> |Structured Extraction| BE
        BE --> |Store Data| DB[(SQLite/Postgres)]
    end
    
    BE --> |Return JSON| FE
    FE --> |Renders UI| User
```

## 🛠️ Tech Stack
- **Framework**: [Next.js 15](https://nextjs.org/) (React 19)
- **Language**: TypeScript
- **Tooling**: Turbopack, ESLint

## 🎥 Demo Video
*(Insert Loom or YouTube demo link here showing the extraction process in real-time)*

---
*Created as part of a professional portfolio showcasing full-stack product development.*
