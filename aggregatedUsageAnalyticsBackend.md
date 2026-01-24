Product Requirements Document (PRD)
Feature: Aggregated Usage Analytics Backend
1. Overview

This feature introduces a lightweight backend service that receives aggregated usage events from the Chrome extension and persists them in a database for analysis.

The goal is to understand whether the extension is being used, how often, and which actions generate value, without collecting personal data or chat content.

2. Problem Statement

After releasing the MVP, there is no visibility into real-world usage:

It is unclear whether users are actively using the extension

There is no data to assess feature adoption

Business assumptions (frequency of use, value per user) cannot be validated

At the same time, privacy constraints and Chrome Web Store policies prevent collecting granular or user-identifiable data.

3. Objectives
Primary Objective

Measure how often key actions are performed in the extension.

Secondary Objectives

Track relative usage between features.

Measure volume processed per action (files).

Enable trend analysis over time (daily granularity).

4. Non-Goals

User-level analytics

Session tracking

Personal or identifiable data collection

Content inspection or metadata storage

Real-time dashboards (v1)

5. Events Scope
5.1 Supported Events (v1)

The backend will accept the following events:

Event name	Description
magic_scan	User clicks the Magic Scan button
full_scan	User clicks the Full Scan button
5.2 Event Semantics

Each event represents a completed user action, not intermediate steps.

Events are emitted only after the action completes successfully.

6. Event Payload (Contract)
6.1 Request

POST /events

{
  "event": "magic_scan",
  "total_items": 12,
  "timestamp": 1737632400
}

6.2 Field definitions
Field	Type	Description
event	string	Event type (magic_scan | full_scan)
total_items	number	Number of files processed in the action
timestamp	number	Unix timestamp (seconds)
6.3 Explicit exclusions

The payload must never include:

Chat identifiers

File names

File URLs

Message metadata

User identifiers

Installation IDs

7. Aggregation Model

Events are aggregated by calendar day.

Aggregation key

Date (YYYY-MM-DD)

Event name

8. Database Schema (InstantDB)
8.1 Table: daily_events
Field	Type	Description
date	string	Day in YYYY-MM-DD format
event	string	Event name
total_events	number	Number of times the event occurred that day
total_items	number	Sum of total_items for that event/day
8.2 Example row
{
  "date": "2026-01-24",
  "event": "magic_scan",
  "total_events": 18,
  "total_items": 214
}

9. Backend Behavior
9.1 Event Ingestion Logic

Upon receiving POST /events:

Parse and validate payload

Convert timestamp → date (YYYY-MM-DD)

Look up existing row by:

date

event

If exists:

Increment total_events by 1

Increment total_items by payload value

If not exists:

Create new row with:

total_events = 1

total_items = payload.total_items

10. Validation Rules

event must be one of the supported values

total_items must be a non-negative integer

Requests with missing or invalid fields are rejected

Backend must be resilient to duplicate events (best-effort idempotency)

11. Security & Privacy
11.1 Privacy Guarantees

No personal data stored

No content data stored

No identifiers stored

Aggregation at day-level only

11.2 Transport Security

HTTPS only

No cookies required

No authentication required in v1 (rate-limited)

12. Rate Limiting & Abuse Prevention

Basic rate limiting per IP

Graceful handling of spikes

Dropping excessive requests is acceptable (metrics are best-effort)

13. Reporting & Analysis (v1)

The persisted data must allow answering:

How many scans happen per day?

Which scan type is used more?

Average number of files per scan

Trends over time (growth / decay)

Example derived metric:

avg_items_per_magic_scan = total_items / total_events

14. Out of Scope (v1)

Real-time dashboards

User segmentation

Per-install tracking

Event-level raw logs

Data export APIs

15. Success Criteria

Backend reliably receives events from the extension

Aggregated data matches expected usage patterns

No Chrome Web Store issues related to data collection

Ability to validate or invalidate business assumptions within 30 days

16. Rationale Summary

This backend design:

Provides just enough signal to validate product value

Respects user privacy and Chrome policies

Avoids premature complexity

Scales naturally as usage grows

Can be extended later with minimal schema changes