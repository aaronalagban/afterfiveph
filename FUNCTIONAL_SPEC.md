# Functional Specification Document (FSD) - AfterFivePH

## 1. Project Overview
AfterFivePH is a platform designed to aggregate, manage, and display local events and community activities. It utilizes automated scraping (Instagram), manual user submissions, and an administrative review process to curate a feed of high-quality events for various communities.

## 2. Core Functional Modules

### 2.1. Event Aggregation (Scraper)
- **Instagram Integration**: Connects to Instagram to fetch event-related posts.
- **Image Processing**: Extracts and processes images from social media posts.
- **Classification & Validation**: 
  - Uses AI/Rules to classify content as a valid "event".
  - Validates event details (date, time, venue, description).
- **Concurrency & Retry**: Handles high-volume scraping with built-in retry logic and concurrency management.

### 2.2. User Submission System
- **Manual Submission Form**: Allows users to manually input event details (Name, Date, Location, Description, Category).
- **Draft Management**: Submissions are initially held in a "Pending" or "Admin Queue" state.

### 2.3. Administrative Workflow
- **Admin Queue**: A dedicated dashboard for administrators to review, edit, approve, or reject pending event submissions.
- **Approval Actions**: Approving an event triggers database updates and potentially further scraping/validation processes.
- **Venue Management**: Repository and service layers for managing a directory of venues associated with events.

### 2.4. Community & Feed Management
- **Event Feed**: A dynamic, filterable list of events.
- **Communities**: Scoped views for specific interest groups or geographic locations.
- **Planet Profiles**: Detailed views for specific community entities.

## 3. Technical Architecture

### 3.1. Frontend
- **Framework**: Next.js (App Router).
- **Styling**: Tailwind CSS / Global CSS.
- **UI Components**: Modular components for feeds, forms, and profiles.

### 3.2. Backend & API
- **API Routes**:
  - `/api/scrape`: Triggers the automated scraping process.
  - `/api/submit-event`: Handles manual user submissions.
  - `/api/admin-action`: Processes administrative decisions (approve/reject).
- **Services**: Dedicated service classes for Events, Venues, Scrapers, and Images.

### 3.3. Data Persistence
- **Database**: Supabase (PostgreSQL).
- **Repository Pattern**: Abstracted data access layers (`events.repository.ts`, `venues.repository.ts`) for clean separation of concerns.

## 4. Key Workflows

1. **Automated Flow**: Instagram Scraper -> Validation -> Database -> Admin Queue (optional) -> Live Feed.
2. **Manual Flow**: User Form -> Database -> Admin Queue -> Review -> Approved -> Live Feed.
3. **Admin Flow**: Dashboard -> Filter Pending -> Edit/Correct -> Approve -> Update Repository.

## 5. External Integrations
- **Supabase**: Auth and Database.
- **Instagram**: Source for event data.
- **OCR/Tesseract (implied by .traineddata)**: Likely used for extracting text from event flyers.
